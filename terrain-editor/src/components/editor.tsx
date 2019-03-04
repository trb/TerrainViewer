import {HeightMap} from "../lib/heightmap";
import * as React from "react";
import {Terrain} from "./terrain";

import * as Rx from 'rxjs/Rx';

const fs = window.require('fs');

window.require('bootstrap');
const remote = window.require('electron').remote;

interface EditorReactState {
    data: EditorState
}

interface StateEvent {
    type: string,
    data: any
}

enum DistanceUnit {Feet, Meters, Pixel}

interface Height {
    min: number,
    max: number,
    unit: DistanceUnit,
    feetPerPixel: number,
    resolution: number
}

interface Dimensions {
    width: number,
    length: number,
    area: number,
    unit?: DistanceUnit
}

interface Size {
    meters: Dimensions,
    feet: Dimensions,
    pixels: Dimensions,
}

interface TrackInfo {
    height: Height,
    size: Size,
    name: string
}

function initEditorState(): EditorState {
    return {
        trackDirectory: ''
    }
}

interface TrackInfoProps {
    trackInfo: TrackInfo
}

function TrackInfo({trackInfo}: TrackInfoProps): JSX.Element {
    return (
        <div>
            <h1>{trackInfo.name}</h1>
            <dl>
                <dt>Length (feet):</dt>
                <dd>{trackInfo.size.feet.length}</dd>
                <dt>Low point:</dt>
                <dd>{trackInfo.height.min}</dd>
                <dt>High point:</dt>
                <dd>{trackInfo.height.max}</dd>
                <dt>Terrain map size:</dt>
                <dd>{trackInfo.size.pixels.width} x {trackInfo.size.pixels.length} Pixel</dd>
            </dl>
        </div>
    );
}

interface EditorState {
    trackDirectory: string,
    trackInfo?: TrackInfo,
    heightMap?: HeightMap
}

export class Editor extends React.Component {
    trackDirectory: Rx.Subject<string>;
    trackDirectory$: Rx.Observable<string>;
    trackInfo$: Rx.Observable<TrackInfo>;
    heightMap$: Rx.Observable<HeightMap>;
    state$: Rx.Observable<EditorState>;
    state: EditorReactState = {
        data: initEditorState()
    };

    componentDidMount(): void {
        this.trackDirectory = new Rx.Subject<string>();
        this.trackDirectory$ = this.trackDirectory.startWith('/home/thomas/Code/Javascript/MXSimTerrain/test/blank/');
        this.trackInfo$ = this.trackDirectory$
            .map((directory: string) => `${directory}/terrain.hf`)
            .filter((terrainFile) => fs.existsSync(terrainFile))
            .map((terrainFile: string): TrackInfo => {
                const name = terrainFile.split('/').reverse()[1];

                const terrain = fs.readFileSync(terrainFile)
                    .toString()
                    .split(' ')
                    .map(Number);

                const height: Height = {
                    resolution: terrain[0],
                    feetPerPixel: terrain[1],
                    min: terrain[2],
                    max: terrain[3],
                    unit: DistanceUnit.Feet
                };

                const pixelLength = (2 ** (height.resolution + 1)) + 1;
                const feetLength = pixelLength * height.feetPerPixel;
                const metersLength = feetLength / 3.28084;

                return {
                    height: height,
                    size: {
                        meters: {
                            width: metersLength,
                            length: metersLength,
                            area: metersLength * metersLength,
                            unit: DistanceUnit.Meters
                        },
                        feet: {
                            width: feetLength,
                            length: feetLength,
                            area: feetLength * feetLength,
                            unit: DistanceUnit.Feet
                        },
                        pixels: {
                            width: pixelLength,
                            length: pixelLength,
                            area: pixelLength * pixelLength,
                            unit: DistanceUnit.Pixel
                        }
                    },
                    name: name
                }
            });
        this.heightMap$ = this.trackDirectory$
            .map((directory: string) => `${directory}/terrain.png`)
            .filter((terrainFile: string) => fs.existsSync(terrainFile))
            .map((terrainFile: string) => new HeightMap(terrainFile));

        this.state$ = Rx.Observable.merge(
            this.trackDirectory$.map((path: string): StateEvent => ({
                type: 'new-track-directory',
                data: path
            })),
            this.trackInfo$.map((trackInfo: TrackInfo): StateEvent => ({
                type: 'new-track-info',
                data: trackInfo
            })),
            this.heightMap$.map((heightMap: HeightMap): StateEvent => ({
                type: 'new-heightmap',
                data: heightMap
            }))
        )
            .scan((state, event) => {
                switch (event.type) {
                    case 'new-track-directory':
                        state.trackDirectory = event.data;
                        return state;
                    case 'new-track-info':
                        state.trackInfo = event.data;
                        return state;
                    case 'new-heightmap':
                        state.heightMap = event.data;
                        return state;
                }

                return state;
            }, initEditorState());

        this.state$.subscribe((state: EditorState) => {
            this.setState({
                data: state
            });
        });
    };

    openDirectory = (event: React.MouseEvent<HTMLButtonElement>): void => {
        event.preventDefault();
        const filePaths: string[] = remote.dialog.showOpenDialog({
            title: 'Select track',
            properties: ['openDirectory', 'createDirectory']
        });
        this.trackDirectory.next(filePaths[0]);
    };

    render() {
        let path = '';
        let pathError: JSX.Element = <span></span>;
        if (this.state.data.trackDirectory) {
            path = this.state.data.trackDirectory;

            if (!fs.existsSync(`${this.state.data.trackDirectory}/terrain.hf`)) {
                pathError =
                    <span>Directory <b>{path}</b> does not seem to be a MX Simulator track directory</span>;
            }
        }

        let trackInfo;
        if (this.state.data.trackInfo) {
            trackInfo = <TrackInfo trackInfo={this.state.data.trackInfo}/>
        }

        let terrain: JSX.Element | null = null;
        if (this.state.data.heightMap) {
            terrain = <Terrain heightMap={this.state.data.heightMap}/>;
        }

        return (
            <div className="container-fluid">
                <div className="row">
                    <div className="col">
                        <form>
                            <div className="form-group">
                                <button className="btn btn-primary"
                                        onClick={this.openDirectory}>
                                    Open Track Directory
                                </button>
                            </div>
                        </form>
                    </div>
                    <div className="col">
                        {trackInfo}
                    </div>
                </div>
                <div className="row">
                    {pathError}
                    {terrain}
                </div>
            </div>
        )
    }
}