import { dirname, join, relative } from 'path'
import { CommandResult, Package, PackageFile, PackageDependency } from '../../types/index.js'
import { DIR_PATTERNS, PACKAGE_PATHS, UNVERSIONED } from '../../constants/index.js'
import { exists, ensureDir, readTextFile, writeTextFile } from '../../utils/fs.js'
import { normalizePathForProcessing, isWithinDirectory } from '../../utils/path-normalization.js'
import { createWorkspacePackageYml, ensurePackageWithYml, addPackageToYml, updatePackageDependencyInclude, writeLocalPackageFromRegistry } from '../../utils/package-management.js'
import { packageManager } from '../package.js'
import { getLocalPackageDir, getLocalPackageYmlPath } from '../../utils/paths.js'
import { parsePackageYml } from '../../utils/package-yml.js'
import { readPackageFilesForRegistry } from '../../utils/package-copy.js'
import { buildMappingAndWriteIndex } from '../add/package-index-updater.js'
import { getDetectedPlatforms } from '../platforms.js'
import { PackageContext } from '../package-context.js'
import { logger } from '../../utils/logger.js'
import { mapPlatformFileToUniversal } from '../../utils/platform-mapper.js'
import { arePackageNamesEquivalent } from '../../utils/package-name.js'
import { performPlatformSync, PlatformSyncResult } from '../sync/platform-sync.js'

const SINGLE_FILE_PACKAGE = 'f'

export interface SingleFileSaveOptions {
	dev?: boolean
}

interface SingleFileSaveResult {
	packageFiles: PackageFile[]
	syncResult?: PlatformSyncResult
}

export async function runSingleFileSave(
	absolutePath: string,
	options: SingleFileSaveOptions = {}
): Promise<CommandResult<SingleFileSaveResult>> {
	const cwd = process.cwd()
	const normalizedInput = normalizePathForProcessing(relative(cwd, absolutePath))

	await validateInputPath(cwd, absolutePath, normalizedInput)

	await createWorkspacePackageYml(cwd)

	// Ensure local cache for f@0.0.0; refresh from registry when present.
	const ensured = await ensurePackageWithYml(cwd, SINGLE_FILE_PACKAGE, {
		defaultVersion: undefined,
		interactive: false
	})
	const packageRootDir = dirname(ensured.packageDir)
	const packageYmlPath = ensured.packageYmlPath

	await refreshFromRegistryIfAvailable(cwd)

	const registryPath = resolveRegistryPath(normalizedInput, absolutePath)

	// Copy the file into the cached package directory, preserving relative path.
	const targetPath = join(packageRootDir, registryPath)
	await ensureDir(dirname(targetPath))
	const content = await readTextFile(absolutePath)
	await writeTextFile(targetPath, content)

	// Rebuild index for f to include new file list.
	const packageFiles = await readPackageFilesForRegistry(packageRootDir)
	const filteredFiles = packageFiles.filter(f => f.path !== PACKAGE_PATHS.INDEX_RELATIVE)
	const packageContext: PackageContext = {
		name: SINGLE_FILE_PACKAGE,
		version: UNVERSIONED,
		config: await parsePackageYml(packageYmlPath),
		packageYmlPath,
		packageRootDir,
		packageFilesDir: ensured.packageDir,
		location: 'nested',
		isCwdPackage: false,
		isNew: ensured.isNew
	}

	const detectedPlatforms = await getDetectedPlatforms(cwd)
	await buildMappingAndWriteIndex(cwd, packageContext, packageFiles, detectedPlatforms, {
		preserveExactPaths: true,
		versionOverride: UNVERSIONED
	})

	// Ensure dependency entry and include list in workspace package.yml
	const targetArray: 'packages' | 'dev-packages' = options.dev ? 'dev-packages' : 'packages'
	await addPackageToYml(cwd, SINGLE_FILE_PACKAGE, undefined, options.dev ?? false, undefined, true, undefined)
	const mergedInclude = await mergeDependencyInclude(cwd, targetArray, registryPath)
	await updatePackageDependencyInclude(cwd, SINGLE_FILE_PACKAGE, targetArray, mergedInclude)

	// Persist updated f package to local registry
	const pkg: Package = {
		metadata: { ...packageContext.config, name: SINGLE_FILE_PACKAGE, version: UNVERSIONED },
		files: filteredFiles
	}
	await packageManager.savePackage(pkg)

	// Sync root/platform files to workspace targets (matches standard save flow)
	const syncResult = await performPlatformSync(
		cwd,
		SINGLE_FILE_PACKAGE,
		UNVERSIONED,
		filteredFiles,
		{
			packageLocation: 'nested',
			conflictStrategy: 'overwrite',
			skipRootSync: false
		}
	)

	logger.info(`Saved single file to local registry: ${registryPath} -> ${SINGLE_FILE_PACKAGE}@${UNVERSIONED}`)

	return {
		success: true,
		data: { packageFiles: filteredFiles, syncResult }
	}
}

async function validateInputPath(cwd: string, absolutePath: string, normalizedInput: string): Promise<void> {
	if (!(await exists(absolutePath))) {
		throw new Error(`Path '${normalizedInput}' does not exist`)
	}

	if (!isWithinDirectory(cwd, absolutePath)) {
		throw new Error('Path must be within the current working directory.')
	}

	const openpackageDir = join(cwd, '.openpackage')
	if (isWithinDirectory(openpackageDir, absolutePath)) {
		throw new Error('Cannot save files from inside the .openpackage directory.')
	}
}

async function refreshFromRegistryIfAvailable(cwd: string): Promise<void> {
	const localPackageDir = getLocalPackageDir(cwd, SINGLE_FILE_PACKAGE)
	try {
		await packageManager.loadPackage(SINGLE_FILE_PACKAGE, UNVERSIONED)
		await ensureDir(localPackageDir)
		await writeLocalPackageFromRegistry(cwd, SINGLE_FILE_PACKAGE, UNVERSIONED)
	} catch {
		// If the package does not exist in the registry yet, continue with local cache creation.
		return
	}
}

function resolveRegistryPath(normalizedInput: string, absolutePath: string): string {
	const platformMapping = mapPlatformFileToUniversal(absolutePath)
	if (platformMapping) {
		const { subdir, relPath } = platformMapping
		return normalizePathForProcessing(
			[DIR_PATTERNS.OPENPACKAGE, subdir, relPath].filter(Boolean).join('/')
		)
	}
	return normalizedInput
}

async function mergeDependencyInclude(
	cwd: string,
	targetArray: 'packages' | 'dev-packages',
	newPath: string
): Promise<string[]> {
	const packageYmlPath = getLocalPackageYmlPath(cwd)
	const config = (await exists(packageYmlPath)) ? await parsePackageYml(packageYmlPath) : null
	const currentFiles: string[] = []

	if (config && config[targetArray]) {
		const deps = config[targetArray] as PackageDependency[]
		const idx = deps.findIndex(dep => arePackageNamesEquivalent(dep.name, SINGLE_FILE_PACKAGE))
		if (idx >= 0 && Array.isArray(deps[idx].include)) {
			currentFiles.push(...deps[idx].include as string[])
		}
	}

	const unique = Array.from(new Set([...currentFiles, newPath])).filter(Boolean)
	return unique
}

