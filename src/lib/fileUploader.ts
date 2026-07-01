import fs from 'fs/promises';
import path from 'path';

/**
 * Saves a File or Blob to the local file system.
 * 
 * @param file The file to save
 * @param folderName The category folder inside public/uploads (e.g. 'tasks', 'profiles')
 * @returns The public URL string of the saved file
 */
export const saveLocalFile = async (file: File | Blob, folderName: string): Promise<string> => {
  const buffer = Buffer.from(await file.arrayBuffer());
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', folderName);
  
  await fs.mkdir(uploadDir, { recursive: true });
  
  // Cast to File to safely access .name, falling back to 'file' if unavailable
  const fileName = (file as File).name || 'file';
  // Replace spaces and unsafe characters
  const safeName = fileName.replace(/[^a-zA-Z0-9.\-_]/g, '_');
  const uniqueFilename = `${Date.now()}-${safeName}`;
  const filePath = path.join(uploadDir, uniqueFilename);
  
  await fs.writeFile(filePath, buffer);
  
  return `/uploads/${folderName}/${uniqueFilename}`;
};
