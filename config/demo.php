<?php

return [
    'admin_password' => env('DEMO_ADMIN_PASSWORD'),
    'super_password' => env('DEMO_SUPER_PASSWORD'),
    'role_profiles' => database_path('seeders/client-demo-roles.json'),
];
