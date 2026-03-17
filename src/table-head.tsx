import {Moon} from "react-bootstrap-icons";
import {themeManager} from "./ThemeManager.ts"

export default function TableHead() {
    return <thead>
    <tr>
        <th>
            <Moon style={{marginBottom: '20px'}} onClick={() => { themeManager.toggle() }}/>
        </th>
        <th style={{width: '120px'}}>Head</th>
    </tr>
    </thead>;
}