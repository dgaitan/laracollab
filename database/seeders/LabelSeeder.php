<?php

namespace Database\Seeders;

use App\Models\Label;
use Illuminate\Database\Seeder;

class LabelSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        Label::insert([
            ['name' => 'Bug', 'color' => '#D6336C'],
            ['name' => 'Issue', 'color' => '#D6336C'],
            ['name' => 'Improvement', 'color' => '#D6336C'],
            ['name' => 'Change Request', 'color' => '#D6336C'],
            ['name' => 'New request', 'color' => '#D6336C'],
        ]);
    }
}
