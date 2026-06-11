import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { loginSchema } from '@/lib/schemas/auth'
import type { LoginFormValues } from '@/lib/schemas/auth'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { InlineError } from '@/components/ui/InlineError'

export function LoginPage() {
  const { signIn } = useAuth()
  const [signInError, setSignInError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    mode: 'onSubmit',
  })

  async function onSubmit(values: LoginFormValues) {
    setSignInError(null)
    const { error } = await signIn(values.email, values.password)
    if (error) setSignInError(error)
    // On success the auth state change re-renders the gate — no navigation needed.
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-grey-50 p-4 dark:bg-grey-900">
      <div className="w-full max-w-sm rounded-lg border border-grey-200 bg-grey-100 p-6 dark:border-grey-700 dark:bg-grey-800">
        <h1 className="mb-6 text-center text-lg font-medium text-grey-800 dark:text-grey-100">
          花語 HuaYu
        </h1>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-2">
            <Label htmlFor="login-email">Email</Label>
            <Input
              id="login-email"
              type="email"
              autoComplete="email"
              aria-describedby={errors.email ? 'login-email-error' : undefined}
              aria-invalid={Boolean(errors.email)}
              {...register('email')}
            />
            {errors.email && (
              <p id="login-email-error" className="text-xs text-[#991b1b] dark:text-[#fca5a5]">
                {errors.email.message}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="login-password">Password</Label>
            <Input
              id="login-password"
              type="password"
              autoComplete="current-password"
              aria-describedby={errors.password ? 'login-password-error' : undefined}
              aria-invalid={Boolean(errors.password)}
              {...register('password')}
            />
            {errors.password && (
              <p id="login-password-error" className="text-xs text-[#991b1b] dark:text-[#fca5a5]">
                {errors.password.message}
              </p>
            )}
          </div>

          {signInError && <InlineError message={signInError} />}

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </div>
    </div>
  )
}
