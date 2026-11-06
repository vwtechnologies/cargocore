<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\HasMany;

class Company extends Record
{
    public function subCompanies(): HasMany
    {
        return $this->hasMany(SubCompany::class);
    }

    public function people(): HasMany
    {
        return $this->hasMany(PersonCompany::class);
    }
}
