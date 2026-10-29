import { BaseSequencer, type TestSpecification } from 'vitest/node';
import { list as sequentialTestsList } from './sequentialTests.js';

export default class CustomSequencer extends BaseSequencer {
	override async sort(files: TestSpecification[]): Promise<TestSpecification[]> {
		const sortedFiles = Array.from(files);

		if (sortedFiles.length <= 1) return sortedFiles;

		const findFileIndex = (testFilePath: string) =>
			sortedFiles.findIndex((file) => file.moduleId.endsWith(testFilePath));

		// If specified, only run these tests sequentially
		if (sequentialTestsList.only.length > 0) {
			return sequentialTestsList.only.flatMap(({ testFilePath }) => {
				const index = findFileIndex(testFilePath);
				return index !== -1 ? [sortedFiles[index]!] : [];
			});
		}

		for (const { testFilePath } of sequentialTestsList.before.slice().reverse()) {
			const index = findFileIndex(testFilePath);
			if (index !== -1) sortedFiles.unshift(sortedFiles.splice(index, 1)[0]!);
		}

		for (const { testFilePath } of sequentialTestsList.after) {
			const index = findFileIndex(testFilePath);
			if (index !== -1) sortedFiles.push(sortedFiles.splice(index, 1)[0]!);
		}

		return sortedFiles;
	}
}
