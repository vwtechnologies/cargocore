<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\HasMany;

class Marka extends Record
{
    public function personAssignments(): HasMany
    {
        return $this->hasMany(PersonMarka::class);
    }
}
