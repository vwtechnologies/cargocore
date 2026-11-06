<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureHttps
{
    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $applicationUrl = (string) config('app.url');

        if (app()->isProduction() && ! $request->isSecure() && parse_url($applicationUrl, PHP_URL_SCHEME) === 'https') {
            return redirect()->away(rtrim($applicationUrl, '/').$request->getRequestUri(), Response::HTTP_PERMANENTLY_REDIRECT);
        }

        return $next($request);
    }
}
