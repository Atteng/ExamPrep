import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Admin Supabase Client
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    // Admin Supabase Client (Init inside handler to avoid build-time env crash)
    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || 'dummy_key'
    );

    try {
        const secret = process.env.PAYSTACK_SECRET_KEY || 'dummy_key_for_build';
        const headersList = await headers();
        const signature = headersList.get('x-paystack-signature');

        if (!signature) {
            // Likely build time check or invalid request
            return NextResponse.json({ error: 'No Signature' }, { status: 400 });
        }

        // Read Raw Body for Verification
        const textBody = await req.text();

        // Verify Signature
        const hash = crypto.createHmac('sha512', secret)
            .update(textBody)
            .digest('hex');

        if (hash !== signature) {
            console.error("Invalid Paystack Signature");
            return NextResponse.json({ error: 'Invalid Signature' }, { status: 401 });
        }

        // Parse Event
        const event = JSON.parse(textBody);
        console.log(`Webhook Received: ${event.event} [${event.data.reference}]`);

        // Handle Charge Success (One-time or Subscription Initialization)
        if (event.event === 'charge.success') {
            const data = event.data;
            const metadata = data.metadata || {};

            // Custom Metadata (userId) MUST be present to link to user
            let userId = metadata.userId;

            // If metadata is custom_fields array (Paystack weirdness sometimes), extract it
            if (!userId && data.metadata?.custom_fields) {
                const field = data.metadata.custom_fields.find((f: any) => f.variable_name === 'userId');
                if (field) userId = field.value;
            }

            if (userId) {
                console.log(`✅ Activating Pro for User: ${userId}`);

                await supabaseAdmin
                    .from('profiles')
                    .update({
                        is_pro: true,
                        paystack_customer_code: data.customer.customer_code,
                        paystack_sub_code: data.plan ? data.subscription_code : null, // If it was a plan
                        subscription_status: 'active'
                    })
                    .eq('id', userId);
            } else {
                console.warn("⚠️ Charge Success but NO UserId in metadata");
            }
        }

        // Handle Subscription Cancellation
        if (event.event === 'subscription.disable') {
            const email = event.data.customer.email;
            // We might need to look up by email or customer code
            const customerCode = event.data.customer.customer_code;

            console.log(`🚫 Deactivating Pro for Customer: ${customerCode}`);

            await supabaseAdmin
                .from('profiles')
                .update({
                    is_pro: false,
                    subscription_status: 'canceled'
                })
                .eq('paystack_customer_code', customerCode);
        }

        return NextResponse.json({ status: 'success' });

    } catch (err: any) {
        console.error("Webhook Error:", err);
        return NextResponse.json({ error: 'Webhook Handler Failed' }, { status: 500 });
    }
}
