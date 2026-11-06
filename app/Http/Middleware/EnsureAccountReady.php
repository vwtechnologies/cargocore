<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class EnsureAccountReady
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if (! $user || ! $user->status || ! $user->role?->status) {
            Auth::guard('web')->logout();
            $request->session()->invalidate();
            abort(401, 'Your account is inactive or your session has expired.');
        }

        return $next($request);
    }
}
