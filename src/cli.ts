#!/usr/bin/env node

import * as commander from "commander";
import { spawn } from "child_process";

commander.version('0.0.1').parse(process.argv);

(async () => {
	console.log(`Yay ${process.cwd()}`);

	console.log(await hasDocker());
})();

function exec(command: string, args: string[] = []): Promise<string> {
	return new Promise((resolve, reject) => {
		const docker = spawn(command, args);
		let out = '';
		let err = '';
		docker.stdout.on('data', (data) => {
			out += data;
		});
		docker.stderr.on('data', (data) => {
			err += data;
		});
		docker.on('close', (code) => {
			if (out) {
				return resolve(out);
			}
			reject(err);
		});
	});
}

async function hasDocker(): Promise<string> {
	const version = await exec('docker', ['--version']);
	return version;
}