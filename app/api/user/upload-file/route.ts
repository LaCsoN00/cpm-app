import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

// Définir une interface pour les fichiers formidable n'est plus nécessaire
// interface FormidableFiles {
//     file?: File[];
// }

export const config = {
    api: {
        bodyParser: false, // Pas strictement nécessaire si on utilise req.formData() mais bonne pratique
    },
};

export async function POST(req: NextRequest) {
    const uploadDirectory = path.join(process.cwd(), 'public/uploads');

    try {
        await fs.mkdir(uploadDirectory, { recursive: true });

        const formData = await req.formData();
        const file = formData.get('file');

        if (!file || !(file instanceof File)) {
            return NextResponse.json({ message: 'No file uploaded or file is not valid' }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const filePath = path.join(uploadDirectory, file.name);

        await fs.writeFile(filePath, buffer);

        const publicFilePath = `/uploads/${file.name}`;

        return NextResponse.json({ url: publicFilePath, message: 'File uploaded successfully' });

    } catch (error) {
        console.error('Error uploading file:', error);
        return NextResponse.json({ message: 'Error uploading file', error: (error as Error).message }, { status: 500 });
    }
}
