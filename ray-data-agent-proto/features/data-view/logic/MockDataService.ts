export interface LogRecord {
    id: string;
    timestamp: string;
    level: "INFO" | "WARN" | "ERROR";
    source_ip: string;
    user_email: string;
    message: string;
    _pii_detected?: boolean;
    _is_cleaned?: boolean;
}

export class MockDataService {
    private static sourceData: LogRecord[] = [];

    // Generate specific deterministic "random" data
    static generateSourceData(count: number = 50): LogRecord[] {
        if (this.sourceData.length > 0) return this.sourceData;

        const actions = ["Login success", "Login failed", "Checkout", "View item", "Update profile"];
        const domains = ["gmail.com", "yahoo.com", "corp.net", "example.org"];

        this.sourceData = Array.from({ length: count }).map((_, i) => {
            const hasPII = Math.random() > 0.7; // 30% chance of sensitive data in message
            const email = `user_${i}@${domains[Math.floor(Math.random() * domains.length)]}`;

            return {
                id: `log-${1000 + i}`,
                timestamp: new Date(Date.now() - Math.random() * 86400000).toISOString(),
                level: Math.random() > 0.9 ? "ERROR" : "INFO",
                source_ip: `192.168.1.${Math.floor(Math.random() * 255)}`,
                user_email: email,
                message: hasPII
                    ? `User ${email} failed payment with card 4242-4242-${1000 + i}`
                    : `${actions[Math.floor(Math.random() * actions.length)]} for session ${Math.random().toString(36).substring(7)}`,
            };
        });

        return this.sourceData;
    }

    static scanForPII(data: LogRecord[]): LogRecord[] {
        // Simulate "Presidio" finding Patterns
        return data.map(record => {
            const isSuspicious = record.message.includes("card") || record.message.includes("payment");
            return {
                ...record,
                _pii_detected: isSuspicious
            };
        });
    }

    static redactPII(data: LogRecord[]): LogRecord[] {
        return data.map(record => {
            if (!record._pii_detected) return record;

            // Naive redaction simulation
            return {
                ...record,
                message: record.message.replace(/card \d{4}-\d{4}-\d{4}/, "card [REDACTED]"),
                user_email: "[REDACTED_EMAIL]"
            };
        });
    }

    static cleanData(data: LogRecord[]): LogRecord[] {
        // Filter out ERROR logs and nulls
        return data
            .filter(r => r.level !== "ERROR")
            .map(r => ({ ...r, _is_cleaned: true }));
    }
}
