<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\HasMany;

class Country extends Record
{
    public function cities(): HasMany
    {
        return $this->hasMany(City::class);
    }
}
