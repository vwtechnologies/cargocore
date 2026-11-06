<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Person extends Record
{
    protected $table = 'people';

    protected function casts(): array
    {
        return array_merge(parent::casts(), ['date_of_birth' => 'date:Y-m-d', 'joining_date' => 'date:Y-m-d', 'is_employee' => 'boolean']);
    }

    public function city(): BelongsTo
    {
        return $this->belongsTo(City::class);
    }

    public function contacts(): HasMany
    {
        return $this->hasMany(PersonContact::class);
    }

    public function markaAssignments(): HasMany
    {
        return $this->hasMany(PersonMarka::class);
    }

    public function accounts(): HasMany
    {
        return $this->hasMany(PersonBankAccount::class);
    }

    public function associations(): HasMany
    {
        return $this->hasMany(PersonCompany::class);
    }

    public function documents(): HasMany
    {
        return $this->hasMany(Document::class);
    }

    public function employeeProfile(): HasOne
    {
        return $this->hasOne(EmployeeProfile::class);
    }

    public function user(): HasOne
    {
        return $this->hasOne(User::class);
    }
}
