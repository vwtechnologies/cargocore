<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class City extends Record
{
    public function country(): BelongsTo
    {
        return $this->belongsTo(Country::class);
    }
}
