<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class BankBranch extends Record
{
    protected function casts(): array
    {
        return array_merge(parent::casts(), ['phone_numbers' => 'array']);
    }

    public function bank(): BelongsTo
    {
        return $this->belongsTo(Bank::class);
    }

    public function city(): BelongsTo
    {
        return $this->belongsTo(City::class);
    }

    public function officers(): HasMany
    {
        return $this->hasMany(BankOfficer::class);
    }
}
