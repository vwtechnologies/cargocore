<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    protected $guarded = ['id'];

    protected $attributes = ['must_change_password' => false];

    protected $hidden = ['password', 'remember_token', 'two_factor_secret', 'two_factor_recovery_codes', 'two_factor_confirmed_at', 'must_change_password'];

    protected function casts(): array
    {
        return ['password' => 'hashed', 'email_verified_at' => 'datetime', 'two_factor_confirmed_at' => 'datetime', 'status' => 'boolean', 'must_change_password' => 'boolean', 'version' => 'integer'];
    }

    public function role(): BelongsTo
    {
        return $this->belongsTo(Role::class);
    }

    public function person(): BelongsTo
    {
        return $this->belongsTo(Person::class);
    }

    public function companies(): BelongsToMany
    {
        return $this->belongsToMany(Company::class);
    }

    public function isSuperAdmin(): bool
    {
        return $this->role?->name === 'Super Admin' && $this->role->status;
    }

    public function permits(string $permission): bool
    {
        return $this->status && $this->role?->status && ($this->isSuperAdmin() || $this->role->permissions->contains('name', $permission));
    }
}
