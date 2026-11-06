<?php

namespace App\Providers;

use App\Models\User;
use App\Modules\Shared\Audit;
use App\Modules\Shared\EntityRegistry;
use Illuminate\Auth\Events\Failed;
use Illuminate\Auth\Events\Login;
use Illuminate\Auth\Events\Logout;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        foreach (EntityRegistry::permissions() as $permission) {
            Gate::define($permission, fn (User $user) => $user->permits($permission));
        }
        Event::listen(Login::class, fn (Login $e) => Audit::record('login', 'users', $e->user->id, actorId: $e->user->id));
        Event::listen(Logout::class, function (Logout $e): void {
            if ($e->user) {
                Audit::record('logout', 'users', $e->user->id);
            }
        });
        Event::listen(Failed::class, fn (Failed $e) => Audit::record('login_failed', 'users', $e->user?->id));
    }
}
