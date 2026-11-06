<?php

namespace App\Providers;

use App\Models\User;
use App\Modules\Shared\UppercaseData;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Laravel\Fortify\Fortify;

class FortifyServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        Fortify::authenticateUsing(function (Request $request): ?User {
            $user = User::where('username', UppercaseData::text($request->string('username')->toString()))->first();

            if (! $user || ! $user->status || ! $user->role?->status || ! Hash::check($request->string('password')->toString(), $user->password)) {
                return null;
            }

            return $user;
        });
        RateLimiter::for('login', fn (Request $r) => [Limit::perMinute(5)->by(strtolower($r->input('username', '')).'|'.$r->ip()), Limit::perMinute(30)->by($r->ip())]);
    }
}
