<?php
// Copy to config.php (never commit it). The deploy workflow writes it from GitHub secrets.
return [
    // Public HTTPS address of the subdomain, used in upload and download links.
    'public_url' => 'https://detetive.example.com',

    // 32+ random characters, used to sign upload and download links.
    'secret' => 'change-me-to-at-least-32-random-characters',

    // MySQL from cPanel (Databases > MySQL). For local tests: ['dsn' => 'sqlite:/tmp/pd.sqlite'].
    'db' => [
        'dsn' => 'mysql:host=localhost;dbname=cpaneluser_pd;charset=utf8mb4',
        'user' => 'cpaneluser_pd',
        'password' => '',
    ],

    // Outside public_html. Evidence, renders, packs and font cache live here.
    'storage_dir' => __DIR__ . '/storage',

    // Embed Google Fonts in renders (needs outbound HTTPS from the server).
    'web_fonts' => true,

    // One entry per friend: personal token => account. Tokens: 32+ random characters.
    'users' => [
        // 'TOKEN' => ['id' => 'friend1', 'name' => 'Friend One'],
    ],
];
