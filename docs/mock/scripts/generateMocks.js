// scripts/generateMocks.js

import { faker } from '@faker-js/faker';
import fs from 'fs';
import path from 'path';

// --- AYARLAR ---

// Kullanıcı Rollerinin Tanımı ve Sayıları (Kullanıcı İsteğine Göre)
const USER_ROLES = [
  // Yönetim ve Personel
  { role: 'Admin', count: 1, role_value: 'Staff', is_superuser: true, is_staff: true, is_active: true },
  { role: 'Staff', count: 2, role_value: 'Staff', is_superuser: false, is_staff: true, is_active: true },
  { role: 'Trainer', count: 5, role_value: 'Instructor', is_superuser: false, is_staff: true, is_active: true },
  { role: 'Assistant', count: 7, role_value: 'Assistant', is_superuser: false, is_staff: true, is_active: true }, 
  
  // Üyeler ve Misafirler
  { role: 'Member', count: 50, role_value: 'Student', is_superuser: false, is_staff: false, is_active: true },
  { role: 'Guest', count: 10, role_value: 'Guest', is_superuser: false, is_staff: false, is_active: false } 
];

const NUM_DEFINITIONS = 5;
const NUM_GROUPS_PER_DEFINITION = 3;
const NUM_SESSIONS_PER_GROUP = 10;
const NUM_ENROLLMENTS_PER_SESSION = 5;

const MOCK_DIR = path.join(process.cwd(), 'mocks');

// Helper fonksiyon: Dosyaları kaydetmek için
const saveMocks = (data, fileName) => {
  if (!fs.existsSync(MOCK_DIR)) {
    fs.mkdirSync(MOCK_DIR, { recursive: true });
  }
  fs.writeFileSync(path.join(MOCK_DIR, fileName), JSON.stringify(data, null, 2));
  console.log(`✅ ${data.length} adet kayıt ${fileName} dosyasına kaydedildi.`);
};

// --- 1. Temel Statik Veriler ---
const DISCIPLINES = [
  { id: faker.string.uuid(), name: "Salsa", description: "Salsa dansı" },
  { id: faker.string.uuid(), name: "Bachata", description: "Bachata dansı" },
  { id: faker.string.uuid(), name: "Hip-Hop", description: "Hip-Hop dansı" },
  { id: faker.string.uuid(), name: "Bale", description: "Klasik Bale" },
];

const LEVELS = [
  { id: faker.string.uuid(), name: "Yeni Başlayan", order: 1 },
  { id: faker.string.uuid(), name: "Orta Seviye", order: 2 },
  { id: faker.string.uuid(), name: "İleri Seviye", order: 3 },
];

const ROOMS = [
  { id: faker.string.uuid(), name: "Ana Stüdyo A", capacity: 30 },
  { id: faker.string.uuid(), name: "Stüdyo B (Küçük)", capacity: 15 },
];


// --- 2. Kullanıcı Oluşturma Fonksiyonu (username hatası düzeltildi) ---
const createUsers = () => {
  const users = [];

  USER_ROLES.forEach(roleConfig => {
    for (let i = 0; i < roleConfig.count; i++) {
      const firstName = faker.person.firstName();
      const lastName = faker.person.lastName();
      
      // HATA ÇÖZÜMÜ 1: faker.internet.userName() yerine, stabil isim oluşturma metodu.
      const username = (firstName.charAt(0) + lastName + i + faker.number.int({ min: 100, max: 999 })).toLowerCase(); 

      users.push({
        id: faker.string.uuid(),
        username: username,
        email: faker.internet.email({ firstName, lastName, provider: 'mockstudio.com' }).toLowerCase(),
        first_name: firstName,
        last_name: lastName,
        
        // Şemaya göre dinamik alanlar
        role: roleConfig.role_value, // account_Users tablosundaki role alanı
        is_staff: roleConfig.is_staff,
        is_superuser: roleConfig.is_superuser,
        is_active: roleConfig.is_active,
        
        // Ek bilgi (sadece mock için)
        mock_role_type: roleConfig.role, // Kolay okuma için gerçek rol etiketi
        
        date_joined: faker.date.past({ years: 1 }).toISOString(),
        last_login: faker.date.recent({ days: 30 }).toISOString(),
      });
    }
  });

  return users;
};


// --- 3. Kurs Tanımları Oluşturma ---
const createCourseDefinitions = () => {
  const definitions = [];
  for (let i = 0; i < NUM_DEFINITIONS; i++) {
    const discipline = faker.helpers.arrayElement(DISCIPLINES);
    const level = faker.helpers.arrayElement(LEVELS);
    definitions.push({
      id: faker.string.uuid(),
      title: `${discipline.name} - ${level.name} Kursu`,
      description: faker.lorem.paragraph(1),
      discipline_id: discipline.id,
      level_id: level.id,
    });
  }
  return definitions;
};

// --- 4. Kurs Grupları ve Oturumlar Oluşturma (fiyat ve tarih hatası düzeltildi) ---
const createCourseGroupsAndSessions = (definitions, instructors) => {
    const groups = [];
    const sessions = [];
    const instructorIds = instructors.map(i => i.id);

    definitions.forEach(definition => {
        for (let i = 0; i < NUM_GROUPS_PER_DEFINITION; i++) {
            const startDate = faker.date.future({ years: 0.5 });
            const group = {
                id: faker.string.uuid(),
                definition_id: definition.id,
                group_name: `${definition.title} Grubu ${i + 1}`,
                status: faker.helpers.arrayElement(['Active', 'Planned']),
                start_date: startDate.toISOString().split('T')[0],
                end_date: faker.date.future({ refDate: startDate, months: 3 }).toISOString().split('T')[0],
                capacity: faker.number.int({ min: 10, max: 25 }),
                
                // HATA ÇÖZÜMÜ 2: faker.finance.amount yerine number.float kullanılıyor.
                price: faker.number.float({ min: 300, max: 1000, precision: 0.01 }).toFixed(2), 
                
                instructor_id: faker.helpers.arrayElement(instructorIds), // Eğitmen ataması
            };
            groups.push(group);

            // Oturumları oluştur
            for (let j = 0; j < NUM_SESSIONS_PER_GROUP; j++) {
                // HATA ÇÖZÜMÜ 3: days: 0 hatası için zaman manipülasyonu Date objesi üzerinden yapılıyor.
                const sessionDateObj = faker.date.future({ refDate: startDate, days: j * 7 });
                
                // Dersin başlangıç saatini ayarla (Ör: 18:00 ile 20:00 arası rastgele)
                const startHour = faker.number.int({ min: 18, max: 20 });
                const startTime = new Date(sessionDateObj);
                startTime.setHours(startHour, 0, 0, 0); // Saati ve dakikayı ayarla
                
                // Ders süresini belirle (1.0, 1.5 veya 2.0 saat)
                const durationMinutes = faker.helpers.arrayElement([60, 90, 120]);
                const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);

                sessions.push({
                    id: faker.string.uuid(),
                    course_group_id: group.id,
                    session_date: startTime.toISOString().split('T')[0], 
                    start_datetime: startTime.toISOString(),
                    end_datetime: endTime.toISOString(),
                    is_completed: faker.datatype.boolean({ probability: j < 5 ? 0.05 : 0.8 }),
                    room_id: faker.helpers.arrayElement(ROOMS).id,
                });
            }
        }
    });
    return { groups, sessions };
};

// --- 5. Kayıtlar Oluşturma ---
const createEnrollments = (sessions, students) => {
    const enrollments = [];
    const studentIds = students.map(s => s.id);

    sessions.forEach(session => {
        // Her oturuma rastgele öğrenci kaydı
        const studentsToEnroll = faker.helpers.arrayElements(studentIds, { min: 0, max: NUM_ENROLLMENTS_PER_SESSION });
        studentsToEnroll.forEach(studentId => {
            // Sadece aktif öğrencileri kaydet
            if (students.find(s => s.id === studentId)?.is_active) {
                enrollments.push({
                    id: faker.string.uuid(),
                    user_id: studentId,
                    course_session_id: session.id,
                    membership_id: null, 
                    status: 'Enrolled',
                    enrolled_at: faker.date.past({ refDate: session.start_datetime }).toISOString(),
                });
            }
        });
    });
    return enrollments;
};


// --- ANA FONKSİYON ---
const generateMocks = () => {
  console.log('--- Mock Data Üretimi Başlatılıyor ---');

  // 1. Statik verileri kaydet
  saveMocks(DISCIPLINES, 'disciplines.json');
  saveMocks(LEVELS, 'levels.json');
  saveMocks(ROOMS, 'rooms.json');
  
  // 2. Kullanıcıları oluştur
  const users = createUsers();
  saveMocks(users, 'users.json');

  // Rol bazlı kullanıcı filtrelemesi
  // Trainer ve Assistant'ları eğitmen listesine dahil et (Instructor rolü).
  const instructors = users.filter(u => u.role === 'Instructor' || u.role === 'Assistant');
  const students = users.filter(u => u.role === 'Student');

  // 3. Kurs Tanımlarını oluştur
  const definitions = createCourseDefinitions();
  saveMocks(definitions, 'course_definitions.json');

  // 4. Grupları ve Oturumları oluştur
  const { groups, sessions } = createCourseGroupsAndSessions(definitions, instructors);
  saveMocks(groups, 'course_groups.json');
  saveMocks(sessions, 'course_sessions.json');

  // 5. Kayıtları oluştur
  const enrollments = createEnrollments(sessions, students);
  saveMocks(enrollments, 'enrollments.json');

  console.log('\n✨ Tüm mock data dosyaları başarıyla oluşturuldu ve mocks/ klasörüne kaydedildi. ✨');
  
  // Kontrol
  const totalCount = users.length;
  console.log(`\nToplam Üretilen Kullanıcı Sayısı: ${totalCount}`);
  if (totalCount === 75) {
      console.log('Kontrol Başarılı: Kullanıcı sayısı (75) beklenen sayıya uygundur.');
  } else {
      console.warn(`DİKKAT: Kullanıcı sayısı (${totalCount}) beklenen sayıya (75) uymuyor.`);
  }
};

generateMocks();