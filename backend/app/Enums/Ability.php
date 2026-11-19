<?php

namespace App\Enums;

/**
 * Everything a signed-in person can be allowed to do. Each case is registered
 * as a Gate (see AppServiceProvider), so routes use `can:<value>` middleware.
 */
enum Ability: string
{
    case SendMessages = 'send-messages';
    case ReceiveAlerts = 'receive-alerts';
    case SubmitLocations = 'submit-locations';
    case ViewLocations = 'view-locations';
    case StartAlerts = 'start-alerts';
    case EndAlerts = 'end-alerts';
}
