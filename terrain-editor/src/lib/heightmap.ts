import * as Rx from "rxjs/Rx";
import {Metadata, PNG} from "pngjs3";
const fs = window.require('fs');

export class HeightMap {
    terrainFile: string;
    pixels: Rx.Subject<Uint16Array>;
    metaData: Rx.Subject<Metadata>;
    imageData: Rx.Observable<[Uint16Array, Metadata]>;

    constructor(terrainFile: string) {
        this.terrainFile = terrainFile;
        this.pixels = new Rx.Subject<Uint16Array>();
        this.metaData = new Rx.Subject<Metadata>();
        this.imageData = Rx.Observable.combineLatest(
            this.pixels,
            this.metaData,
            (pixels: Uint16Array, metaData: Metadata): [Uint16Array, Metadata] => {
                return [pixels, metaData];
            }
        );
        this._read();
    }

    _read(): void {
        fs.createReadStream(this.terrainFile)
            .pipe(new PNG({
                filterType: -1,
                skipRescale: true
            }))
            .on('parsed', (data: Uint16Array) => {
                this.pixels.next(data);
            })
            .on('metadata', (metaData: Metadata) => {
                this.metaData.next(metaData);
            });
    }
}