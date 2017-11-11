declare module 'mysql2/promise' {

    type ConnectionOptions = {
        readonly connectionLimit: number | undefined;
        readonly host: string | undefined;
        readonly port: string | number | undefined;
        readonly user: string | undefined;
        readonly password: string | undefined;
        readonly database: string | undefined;
    };

    export function createPool(options: ConnectionOptions): Promise<ConnectionPool>;


    export interface ConnectionPool {
        getConnection(): Promise<Connection>;
        end(): Promise<void>;
    }

    export interface Connection {
        execute(query: string, params: any[]): Promise<any[]>;
        query(query: string, params: any[]): Promise<any[]>;
        release(): void;
    }
}
