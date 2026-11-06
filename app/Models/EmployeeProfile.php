<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class EmployeeProfile extends Record
{
    protected function casts(): array
    {
        return array_merge(parent::casts(), ['salary' => 'decimal:2']);
    }

    public function person(): BelongsTo
    {
        return $this->belongsTo(Person::class);
    }

    public function types(): BelongsToMany
    {
        return $this->belongsToMany(EmployeeType::class, 'employee_profile_type');
    }
}
