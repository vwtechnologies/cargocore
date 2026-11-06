<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class SecureAccountSession
{
    public function handle(Request $request, Closure $next): Response
    {
        if ($user = $request->user()) {
            if (! $user->status || ! $user->role?->status) {
                Auth::guard('web')->logout();
                $request->session()->invalidate();
                abort(401, 'Account inactive.');
            }
        }
        $response = $next($request);
        $response->headers->set('X-Content-Type-Options', 'nosniff');
        $response->headers->set('Referrer-Policy', 'same-origin');
        $response->headers->set('X-Frame-Options', 'DENY');
        if ($request->is('api/*', 'user/*', 'login')) {
            $response->headers->set('Cache-Control', 'no-store, private');
        }

        return $response;
    }
}
