<?php

use App\Models\User;
use Illuminate\Support\Facades\Broadcast;

/*
|--------------------------------------------------------------------------
| Broadcast channels
|--------------------------------------------------------------------------
| `chat` is the one shared room. Anybody signed in may listen; whether they
| may *write* is decided by the `send-messages` gate on the HTTP route.
| Returning true (not a user array) makes this a plain private channel.
*/
Broadcast::channel('chat', fn (User $user): bool => true);
