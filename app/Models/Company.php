<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Company extends Record
{
    public function contacts(): HasMany
    {
        return $this->hasMany(CompanyContact::class);
    }

    public function emails(): HasMany
    {
        return $this->hasMany(CompanyEmail::class);
    }

    public function addresses(): HasMany
    {
        return $this->hasMany(CompanyAddress::class);
    }

    public function parentCompany(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_company_id');
    }

    public function subCompanies(): HasMany
    {
        return $this->hasMany(SubCompany::class);
    }

    public function people(): HasMany
    {
        return $this->hasMany(PersonCompany::class);
    }
}
