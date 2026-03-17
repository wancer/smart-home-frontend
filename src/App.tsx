import {useEffect, useState} from 'react'
import './App.scss'
import Record from "./sensor.ts";
import Api from "./api.ts";
import {Alert, Table} from "react-bootstrap";
import TableHead from "./table-head.tsx";
import Row from "./Row.tsx";
import {PaginationControl} from "react-bootstrap-pagination-control";
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts';


const prepareRecordsGraph = (records: Record[]): any[] => {
    records.sort( (a: Record, b: Record): number => (a.DeviceTime > b.DeviceTime ? 1 : -1) )

    const recordsGraph: any[] = [];

    const id = records[0].DeviceId

    records.forEach(
        (record: Record): void => {
            if (record.DeviceId !== id) {
                return
            }
            recordsGraph.push(
                {
                    name: record.DeviceTime,
                    power: record.Power,
                }
            )

        }
    )

    return recordsGraph;
};

function App() {
    const [records, setRecords] = useState<Record[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [recordsGraph, setRecordsGraph] = useState<any[]>([]);
    const [showGraph, setShowGraph] = useState(false);

    const pageSize = 50;

    const api = new Api();

    useEffect(
        () => {
            api.sensors().then((records) => {
                setRecords(records);
                const recordsGraphNew = prepareRecordsGraph(records);
                setRecordsGraph(recordsGraphNew);
            })
        },
        [],
    );

    const CustomizedDot = () => {
        return <></>
    }

    return (
        <div className="centre-container">
            <Alert>
                {<button className={'btn btn-sm btn-success'} style={{float: 'left'}} onClick={() => {setShowGraph(!showGraph)}}>
                    Graph
                </button>}

            </Alert>
            {showGraph &&
                <LineChart width={1200} height={400} data={recordsGraph} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <Line type="monotone" name="Power" dataKey="power" stroke="grey" dot={CustomizedDot} />
                    <CartesianGrid stroke="#ccc" strokeDasharray="5 5" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                </LineChart>
            }
            <Table striped bordered hover className="main-table">
                <TableHead/>
                <tbody>
                {records.slice(pageSize * (currentPage - 1), pageSize * currentPage).map(
                    (record: Record) => <Row key={record.DeviceTime} record={record}/>)
                }
                </tbody>
            </Table>
            <PaginationControl
                page={currentPage}
                between={4}
                total={records.length}
                limit={pageSize}
                changePage={(page) => {
                    setCurrentPage(page)
                }}
                ellipsis={1}
            />
        </div>
    );
}

export default App
