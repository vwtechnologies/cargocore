<?php

use App\Http\Middleware\SecureAccountSession;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(web: __DIR__.'/../routes/web.php', commands: __DIR__.'/../routes/console.php', health: '/up')
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->statefulApi();
        $middleware->trustProxies(at: ['127.0.0.1', '::1'], headers: Request::HEADER_X_FORWARDED_FOR | Request::HEADER_X_FORWARDED_HOST | Request::HEADER_X_FORWARDED_PORT | Request::HEADER_X_FORWARDED_PROTO);
        $middleware->appendToGroup('web', SecureAccountSession::class);
        $middleware->redirectGuestsTo('/login');
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(fn (Request $r) => $r->is('api/*') || $r->expectsJson());
        $exceptions->respond(function (Response $response): Response {
            if ($response instanceof JsonResponse && $response->getStatusCode() >= 400) {
                $body = $response->getData(true);
                $body['code'] ??= match ($response->getStatusCode()) {
                    401 => 'AUTH_REQUIRED',403 => 'FORBIDDEN',404 => 'NOT_FOUND',409 => 'VERSION_CONFLICT',419 => 'CSRF_EXPIRED',422 => 'VALIDATION_FAILED',429 => 'RATE_LIMITED',default => 'REQUEST_FAILED'
                };
                $response->setData($body);
            }

            return $response;
        });
        $exceptions->render(function (QueryException $e, Request $r) {
            if ($r->is('api/*') && in_array($e->getCode(), ['23000', '23505'], true)) {
                return response()->json(['message' => 'This change conflicts with an existing record or reference.', 'code' => 'REFERENCE_CONFLICT'], 409);
            }
        });
    })->create();
