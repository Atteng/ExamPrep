import { NextResponse } from 'next/server';
import { paystack } from '@/lib/paystack';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const reference = searchParams.get('reference') || searchParams.get('trxref');

    if (!reference) {
        return NextResponse.redirect(new URL('/?payment=error', request.url));
    }

    try {
        // 1. Verify Transaction
        const data = await paystack.verifyTransaction(reference);

        if (data.status && data.data.status === 'success') {
            const metadata = data.data.metadata || {};
            // Parse custom_fields if needed (redundant check based on Paystack behavior)
            let userId = metadata.userId;
            if (!userId && metadata.custom_fields) {
                const field = metadata.custom_fields.find((f: any) => f.variable_name === 'userId');
                if (field) userId = field.value;
            }

            // 2. Update DB (Idempotent backup to webhook)
            if (userId) {
                const supabaseAdmin = createClient(
                    process.env.NEXT_PUBLIC_SUPABASE_URL!,
                    process.env.SUPABASE_SERVICE_ROLE_KEY!
                );

                await supabaseAdmin
                    .from('profiles')
                    .update({
                        is_pro: true,
                        paystack_customer_code: data.data.customer.customer_code,
                        paystack_sub_code: data.data.plan_object?.subscriptions[0]?.subscription_code || null, // Best effort
                        subscription_status: 'active'
                    })
                    .eq('id', userId);
            }

            // 3. Redirect to Success
            return NextResponse.redirect(new URL('/?payment=success', request.url));
        } else {
            return NextResponse.redirect(new URL('/?payment=failed', request.url));
        }

    } catch (err) {
        console.error("Callback Error", err);
        return NextResponse.redirect(new URL('/?payment=error', request.url));
    }
}
