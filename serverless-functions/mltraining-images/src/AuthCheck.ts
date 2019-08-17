// internal dependencies
import { HttpResponse } from './Responses';

export default function main(): HttpResponse {
    return new HttpResponse({ ok : true });
}

(<any>global).main = main;
