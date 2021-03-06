import * as fs from "fs";
import * as path from "path";
import * as yauzl from "yauzl";
import * as util from "util";

const access = util.promisify(fs.access);
const mkdir = util.promisify(fs.mkdir);

export class FileSystem {
	public exists(path: string): boolean {
		return fs.existsSync(path);
	}

	public extractZip(pathToZip: string, outputDir: string): Promise<void> {
		return new Promise((resolve, reject) => {
			yauzl.open(pathToZip, { autoClose: true, lazyEntries: true }, (openError, zipFile) => {
				if (openError) {
					return reject(openError);
				}

				zipFile.on('entry', entry => {
					const fn = <string>entry.fileName;
					if (/\/$/.test(fn)) {
						return zipFile.readEntry();
					}

					zipFile.openReadStream(entry, (openStreamError, stream) => {
						if(openStreamError) {
							return reject(openStreamError);
						};

						const filePath = `${outputDir}/${fn}`;

						return createParentDirsIfNeeded(filePath)
							.catch(createParentDirError => reject(createParentDirError))
							.then(() => {
								const outfile = fs.createWriteStream(filePath);
								stream.once('end', () => {
									zipFile.readEntry();
									outfile.close();
								});
								stream.pipe(outfile);
							});
					});
				});

				zipFile.once('end', () => resolve());

				zipFile.readEntry();
			});
		});
	}

	public readDirectory(path: string): string[] {
		return fs.readdirSync(path);
	}

	public readJson<T>(path: string, options?: { encoding?: null; flag?: string; }): T {
		const content = fs.readFileSync(path, options);
		return JSON.parse(content.toString());
	}
}

function createParentDirsIfNeeded(filePath: string) {
	const dirs = path.dirname(filePath).split(path.sep);
	return dirs.reduce((p, dir) => p.then(parent => {
		const current = `${parent}${path.sep}${dir}`;

		return access(current)
			.catch(e => mkdir(current))
			.then(() => current);
	}), Promise.resolve(''));
}
