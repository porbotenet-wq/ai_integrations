import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Camera, X, Loader2, ZoomIn } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";

interface PhotoUploadProps {
  photos: string[];
  onPhotosChange: (urls: string[]) => void;
  folder: string;
  maxPhotos?: number;
  readOnly?: boolean;
  onUploadComplete?: (count: number) => void;
}

const PhotoUpload = ({ photos, onPhotosChange, folder, maxPhotos = 10, readOnly = false, onUploadComplete }: PhotoUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    if (photos.length + files.length > maxPhotos) {
      toast.error(`Максимум ${maxPhotos} фото`);
      return;
    }

    setUploading(true);
    const newUrls: string[] = [];

    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) {
        toast.error(`${file.name} — не изображение`);
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} — слишком большой (макс 10МБ)`);
        continue;
      }

      const ext = file.name.split(".").pop() || "jpg";
      const path = `${folder}/${crypto.randomUUID()}.${ext}`;

      const { error } = await supabase.storage
        .from("photo-reports")
        .upload(path, file, { contentType: file.type });

      if (error) {
        toast.error(`Ошибка загрузки: ${error.message}`);
        continue;
      }

      const { data: urlData } = supabase.storage
        .from("photo-reports")
        .getPublicUrl(path);

      newUrls.push(urlData.publicUrl);
    }

    if (newUrls.length > 0) {
      onPhotosChange([...photos, ...newUrls]);
      toast.success(`Загружено ${newUrls.length} фото`);
      onUploadComplete?.(newUrls.length);
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleRemove = (idx: number) => {
    onPhotosChange(photos.filter((_, i) => i !== idx));
  };

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {photos.map((url, i) => (
          <div key={i} className="relative group w-14 h-14 rounded-md overflow-hidden border border-border bg-muted">
            <img
              src={url}
              alt={`Фото ${i + 1}`}
              className="w-full h-full object-cover cursor-pointer"
              onClick={() => setPreviewUrl(url)}
            />
            {!readOnly && (
              <button
                onClick={() => handleRemove(i)}
                className="absolute top-0.5 right-0.5 bg-destructive text-destructive-foreground rounded-full w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            )}
            <button
              onClick={() => setPreviewUrl(url)}
              className="absolute bottom-0.5 right-0.5 bg-background/80 rounded-full w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <ZoomIn className="w-3 h-3 text-foreground" />
            </button>
          </div>
        ))}

        {!readOnly && photos.length < maxPhotos && (
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="w-14 h-14 rounded-md border-2 border-dashed border-border hover:border-primary/50 flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
          >
            {uploading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Camera className="w-5 h-5" />
            )}
          </button>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleUpload}
      />

      <Dialog open={!!previewUrl} onOpenChange={() => setPreviewUrl(null)}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-1">
          <DialogTitle className="sr-only">Просмотр фото</DialogTitle>
          {previewUrl && (
            <img src={previewUrl} alt="Просмотр" className="w-full h-auto max-h-[85vh] object-contain rounded" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PhotoUpload;
