interface StatCardProps {
    label: string;
    value: string | number;
    icon: string;
    color?: string;
}

export function StatCard({ label, value, icon, color }: StatCardProps) {
    return (
        <div className="glass-card stat-card">
            <span className="stat-card-icon">{icon}</span>
            <div
                className="stat-card-value"
                style={color ? { color } : { color: 'var(--accent-light)' }}
            >
                {value}
            </div>
            <div className="stat-card-label">{label}</div>
        </div>
    );
}
