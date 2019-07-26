export class HtmlResponse {
    constructor (public body: any, public statusCode: number = 200, public headers: object = {}) {

    }
}
