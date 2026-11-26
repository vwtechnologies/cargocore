<?php

namespace App\Modules\Shared;

/**
 * Keeps free text exactly as the user typed it, but snaps dropdown (combobox)
 * values to the option's own spelling when they match it ignoring case, so
 * "male" and "MALE" are both stored as "Male".
 */
class CanonicalOptions
{
    /**
     * @param  array<string, mixed>  $values
     * @return array<string, mixed>
     */
    public static function record(string $entity, array $values): array
    {
        foreach (EntityRegistry::get($entity)['fields'] as $key => $field) {
            if (($field['type'] ?? 'text') !== 'combobox' || ! isset($values[$key]) || ! is_string($values[$key])) {
                continue;
            }
            $values[$key] = self::match($values[$key], $field['options'] ?? []);
        }

        return $values;
    }

    /**
     * @param  list<string>  $options
     */
    public static function match(string $value, array $options): string
    {
        $needle = mb_strtolower(trim($value), 'UTF-8');
        foreach ($options as $option) {
            if (mb_strtolower($option, 'UTF-8') === $needle) {
                return $option;
            }
        }

        return $value;
    }
}
