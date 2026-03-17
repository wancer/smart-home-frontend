import Record from './sensor';

type RowProperties = {
    record: Record,
}

function format(value: number, positions: number): string {
    return value.toFixed(positions);
}

function NumericCell({value, positions}: {value: number, positions: number}) {
    return <td>{format(value, positions)}</td>
}

export default function Row({record}: RowProperties) {
    return <tr>
        <td>{record.DeviceId}</td>
        <td>{record.DeviceTime}</td>
        <NumericCell value={record.Period} positions={2}></NumericCell>
        <NumericCell value={record.Power} positions={2}></NumericCell>
    </tr>
}