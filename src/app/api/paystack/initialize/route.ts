import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies, headers } from 'next/headers';
import { paystack } from '@/lib/paystack';

export async function POST(request: Request) {
    try {
        const cookieStore = await cookies();

        // 1. Authenticate
        const supabaseServer = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    get(name: string) {
                        return cookieStore.get(name)?.value;
                    },
                },
            }
        );

        const { data: { user } } = await supabaseServer.auth.getUser();

        if (!user || !user.email) {
            return NextResponse.json({ error: 'Unauthorized or Email Missing' }, { status: 401 });
        }

        // 2. Transact
        // Default Strategy: Use Plan if available, else Charge 5000 NGN (approx $3.50? No, let's use 10,000 NGN for ~$7-8)
        // Or if user passes currency USD, we charge $10.00 (1000 cents)
        // For now, consistent NGN pricing: 15,000 NGN (~$10)

        const PLANS = {
            monthly_ngn: process.env.PAYSTACK_PLAN_CODE, // Ensure this exists in env
        };

        // FUTURE: Check request body for currency preference?
        // const { currency } = await request.json(); 

        // Use one-time payment (14,985 NGN = 1,498,500 kobo)
        console.log("Initializing One-time Charge: 14,985 NGN");
        const response = await paystack.initializeTransaction(
            user.email,
            1498500, // 14,985 NGN in kobo
            undefined,
            { userId: user.id },
            'NGN'
        );

        return NextResponse.json({ url: response.data.authorization_url });

    } catch (err: any) {
        console.error('Paystack Init Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
