import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    const next = searchParams.get('next') ?? '/'

    if (code) {
        const cookieStore = {
            get(name: string) {
                return request.headers.get('cookie')?.split(';').find(c => c.trim().startsWith(`${name}=`))?.split('=')[1]
            },
            set(name: string, value: string, options: CookieOptions) {
                // Handled below in response
            },
            remove(name: string, options: CookieOptions) {
                // Handled below in response
            }
        }

        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    get(name: string) {
                        return request.headers.get('cookie')?.split(';').find(c => c.trim().startsWith(`${name}=`))?.split('=')[1]
                    },
                    set(name: string, value: string, options: CookieOptions) {
                        // We can't set cookies in the client creation like this in route handler for the same response easily
                        // This is simplified standard example logic
                    },
                    remove(name: string, options: CookieOptions) {
                    },
                },
            }
        )

        // Easier way for Route Handlers:
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error) {
            return NextResponse.redirect(`${origin}${next}`)
        }
    }

    // return the user to an error page with instructions
    return NextResponse.redirect(`${origin}/login?error=auth_code_error`)
}
