<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Bank extends Record
{
    public function country(): BelongsTo
    {
        return $this->belongsTo(Country::class);
    }

    public function branches(): HasMany
    {
        return $this->hasMany(BankBranch::class);
    }

    public function officers(): HasMany
    {
        return $this->hasMany(BankOfficer::class);
    }
}
