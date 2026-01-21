/**
 * Paystack API Helper
 * Docs: https://paystack.com/docs/api/
 */

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY!;

interface PaystackInitializeResponse {
    status: boolean;
    message: string;
    data: {
        authorization_url: string;
        access_code: string;
        reference: string;
    };
}

export const paystack = {
    /**
     * Initialize a Transaction
     * @param email User email
     * @param amountCurrentyInKobo Amount in Kobo (e.g. 10000 = 100 NGN). 
     * @param planCode For subscriptions, pass 'plan' instead if auto-billing is preferred.
     * @param metadata Link to user
     * @param currency Currency Code (NGN, USD, etc). Default NGN.
     */
    async initializeTransaction(
        email: string,
        amountCurrentyInKobo: number,
        planCode?: string,
        metadata?: any,
        currency: string = 'NGN'
    ): Promise<PaystackInitializeResponse> {
        const payload: any = {
            email,
            callback_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/paystack/callback`,
            metadata: metadata || {}, // Send as object, not stringified
        };

        if (planCode) {
            payload.plan = planCode; // Recurring subscription (currency set by plan)
        } else {
            payload.amount = amountCurrentyInKobo; // One-time custom amount
            payload.currency = currency; // Only set currency for one-time charges
        }

        const res = await fetch('https://api.paystack.co/transaction/initialize', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        if (!res.ok) {
            const err = await res.text();
            console.error("Paystack Init Error:", err);
            throw new Error(`Paystack Init Failed: ${res.statusText}`);
        }

        return await res.json();
    },

    /**
     * Verify a Transaction (Server-side check)
     */
    async verifyTransaction(reference: string) {
        const res = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
            },
        });
        return await res.json();
    }
};
