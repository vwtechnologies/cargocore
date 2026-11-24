<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class BankBranch extends Record
{
    public function bank(): BelongsTo
    {
        return $this->belongsTo(Bank::class);
    }

    public function city(): BelongsTo
    {
        return $this->belongsTo(City::class);
    }

    public function contacts(): HasMany
    {
        return $this->hasMany(BankBranchContact::class);
    }

    public function officers(): HasMany
    {
        return $this->hasMany(BankOfficer::class);
    }
}
