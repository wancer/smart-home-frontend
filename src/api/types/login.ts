'use client';

export default class Login {
    public token: string;
    
    constructor(decoded: any) {
        this.token = decoded.token;
    }
}
