import { PageHead } from '../ui';

/** For sections whose backend arrives in a later module. Shown honestly instead of fake data. */
export default function Pending({ title, module, what }: { title: string; module: string; what: string }) {
  return (<><PageHead title={title} />
    <div className="panel"><div className="state"><b>Nothing to show yet</b>{what} This section turns on with <b style={{ display: 'inline' }}>{module}</b>.</div></div></>);
}
