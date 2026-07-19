import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface MultilingualAnnouncementProps {
  announcement: {
    english: string;
    spanish: string;
    french: string;
  };
}

export const MultilingualAnnouncement: React.FC<MultilingualAnnouncementProps> = ({ announcement }) => {
  return (
    <Tabs defaultValue="english" className="w-full">
      <TabsList className="grid w-full grid-cols-3 mb-4">
        <TabsTrigger value="english">English</TabsTrigger>
        <TabsTrigger value="spanish">Español</TabsTrigger>
        <TabsTrigger value="french">Français</TabsTrigger>
      </TabsList>
      <TabsContent value="english">
        <p className="text-sm p-4 border rounded-md bg-muted/50">{announcement.english}</p>
      </TabsContent>
      <TabsContent value="spanish">
        <p className="text-sm p-4 border rounded-md bg-muted/50">{announcement.spanish}</p>
      </TabsContent>
      <TabsContent value="french">
        <p className="text-sm p-4 border rounded-md bg-muted/50">{announcement.french}</p>
      </TabsContent>
    </Tabs>
  );
};
