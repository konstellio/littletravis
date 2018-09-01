#!/usr/bin/env node

import * as commander from "commander";
import { spawn, SpawnOptions } from "child_process";
import { join } from "path";
import { createReadStream, createWriteStream, writeFile } from "fs";
import { Transform } from "stream";
import { randomBytes } from "crypto";

commander.version('0.0.1').parse(process.argv);

(async () => {
	if (await hasDocker() === false) {
		console.error(`Could not detect docker cli.`);
		process.exit();
	}

	const uuid = randomBytes(3).toString('hex');
	const cwd = process.cwd();
	const travisConfigLoc = join(cwd, '.travis.yml');
	const buildScriptLoc = join(cwd, '.travis.build.sh');
	const dockerFileLoc = join(cwd, '.travis.dockerfile');
	const gitIgnoreLoc = join(cwd, '.gitignore');
	const dockerIgnoreLoc = join(cwd, '.dockerignore');

	// Create stream to convert .travis.yml to .travis.build.sh with some edits
	await new Promise((resolve, reject) => {
		const travisFile = createReadStream(travisConfigLoc);
		const buildFile = createWriteStream(buildScriptLoc);
		const transform = new Transform({
			transform(chunk, encoding, done) {
				const replaced = chunk.toString()
				.replace(`travis_run_checkout\n`, `#travis_run_checkout\n`)
				.replace(`travis_run_announce\n`, `cd /home/travis/project\ntravis_run_announce\n`);
				this.push(replaced);
			}
		});
		
		const travisBuild = spawn(
			'docker',
			[
				'run',
				'--rm',
				'-i',
				'travisci/travis-build',
				'bash',
				'-c',
				[
					'cat > .travis.yml',
					'gem install travis > /dev/null',
					'echo "y" | travis version > /dev/null',
					'ln -s `pwd` ~/.travis/travis-build > /dev/null',
					"echo 'yes' | bundle install > /dev/null",
					"echo 'yes' | travis compile --skip-version-check --skip-completion-check",
				].join(' && ')
			],
			{
				windowsVerbatimArguments: false,
				// stdio: ['ignore', 'pipe', 'inherit']
			}
		);

		travisFile.pipe(travisBuild.stdin);

		travisBuild.stdout.pipe(transform).pipe(buildFile);

		travisBuild.on('close', (code, signal) => {
			if (code !== 0) {
				debugger;
			}
			return resolve();
		});
	});

	// Create .travis.dockerfile
	await new Promise((resolve, reject) => {
		writeFile(dockerFileLoc, `FROM travisci/ci-garnet:packer-1490989530
COPY . /home/travis/project
COPY .travis.build.sh /home/travis/build.sh
CMD [ "/home/travis/build.sh" ]`, (err) => {
			if (err) {
				return reject(err);
			}
			resolve();
		});
	});

	// Create .dockerignore
	await new Promise((resolve, reject) => {
		const gitIgnoreFile = createReadStream(gitIgnoreLoc);
		const dockerIgnoreFile = createWriteStream(dockerIgnoreLoc);
		gitIgnoreFile.on('error', (err) => resolve());
		dockerIgnoreFile.on('close', () => resolve());
		gitIgnoreFile.pipe(dockerIgnoreFile);
	});

	const tmpContainerName = `littletravis-${uuid}`;

	await run('docker', ['build', '--file', '.travis.dockerfile', '-t', tmpContainerName, '.']);
	await run('docker', ['run', '--rm', tmpContainerName], { stdio: ['ignore', 'inherit', 'inherit'] });
	await run('docker', ['rmi', '-f', tmpContainerName]);
	
})();

function run(command: string, args?: ReadonlyArray<string>, options?: SpawnOptions): Promise<void> {
	return new Promise((resolve, reject) => {
		const proc = spawn(command, args, options);
		proc.on('close', (code, signal) => {
			if (code !== 0) {
				return reject(new Error(`Unexpected return code ${code} with signal ${signal}.`));
			}
			return resolve();
		});
	});
}

function exec(command: string, args?: ReadonlyArray<string>, options?: SpawnOptions): Promise<string> {
	return new Promise((resolve, reject) => {
		const docker = spawn(command, args, options);
		let out = '';
		let err = '';
		docker.stdout.on('data', (data) => {
			out += data;
		});
		docker.stderr.on('data', (data) => {
			err += data;
		});
		docker.on('close', (code, signal) => {
			if (code !== 0) {
				return reject(new Error(`Unexpected return code ${code} with signal ${signal}.`));
			}
			return resolve(out);
		});
	});
}

async function hasDocker(): Promise<boolean> {
	try {
		await exec('docker', ['--version']);
		return true;
	} catch (err) {
	}
	return false;
}