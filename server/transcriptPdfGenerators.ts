import PDFDocument from "pdfkit";
import { format as formatDate } from "date-fns";
import type { Child, TranscriptCourse, Family } from "@shared/schema";
import { getStandardConfig, getProgressLabel } from "@shared/standardsConfig";

interface TranscriptData {
  child: Child;
  family: Family;
  courses: TranscriptCourse[];
}

// US High School Transcript - Traditional Carnegie Unit format
export function generateUSTranscript(doc: InstanceType<typeof PDFDocument>, data: TranscriptData) {
  const { child, family, courses } = data;
  const standardConfig = getStandardConfig(child.educationStandard);
  const progressLabels = getProgressLabel(child.educationStandard);
  
  // Calculate totals
  const creditsBySubject: Record<string, number> = {};
  const creditsByGrade: Record<string, number> = {};
  let totalCredits = 0;

  courses.forEach(course => {
    const credits = course.credits || 0;
    creditsBySubject[course.subject] = (creditsBySubject[course.subject] || 0) + credits;
    creditsByGrade[course.gradeLevel] = (creditsByGrade[course.gradeLevel] || 0) + credits;
    totalCredits += credits;
  });

  // Header
  doc.fontSize(20)
     .font('Helvetica-Bold')
     .text('OFFICIAL HIGH SCHOOL TRANSCRIPT', { align: 'center' });
  
  doc.moveDown(0.3);
  doc.fontSize(9)
     .font('Helvetica-Oblique')
     .text(`${standardConfig.flag} ${standardConfig.name}`, { align: 'center' });
  doc.moveDown(0.3);
  doc.fontSize(10)
     .font('Helvetica')
     .text('This is to certify that this document is an accurate and complete transcript', { align: 'center' });
  doc.moveDown(2);

  // Student Information
  const leftCol = 72;
  let yPos = doc.y;

  doc.fontSize(12).font('Helvetica-Bold').text('STUDENT INFORMATION', leftCol, yPos);
  yPos += 25;

  doc.fontSize(10).font('Helvetica-Bold').text('Student Name:', leftCol, yPos);
  doc.font('Helvetica').text(child.name, leftCol + 100, yPos);
  yPos += 20;

  doc.font('Helvetica-Bold').text('Date of Birth:', leftCol, yPos);
  doc.font('Helvetica').text(child.birthdate ? formatDate(new Date(child.birthdate), 'MMMM d, yyyy') : 'Not specified', leftCol + 100, yPos);
  yPos += 20;

  doc.font('Helvetica-Bold').text('School:', leftCol, yPos);
  doc.font('Helvetica').text(`${family.familyName} Homeschool`, leftCol + 100, yPos);
  yPos += 20;

  doc.font('Helvetica-Bold').text('Address:', leftCol, yPos);
  doc.font('Helvetica').text(family.address || 'Not specified', leftCol + 100, yPos, { width: 200 });
  yPos += 40;

  // Separator
  doc.moveTo(leftCol, yPos).lineTo(doc.page.width - 72, yPos).stroke();
  yPos += 20;

  // Academic Summary
  doc.fontSize(12).font('Helvetica-Bold').text('ACADEMIC SUMMARY', leftCol, yPos);
  yPos += 25;

  doc.fontSize(10).font('Helvetica-Bold').text(`Total ${progressLabels.creditLabel}:`, leftCol, yPos);
  doc.font('Helvetica').text(`${totalCredits.toFixed(2)} ${progressLabels.creditUnit}`, leftCol + 150, yPos);
  yPos += 20;

  doc.font('Helvetica-Bold').text('Credits by Subject:', leftCol, yPos);
  yPos += 20;

  Object.entries(creditsBySubject).forEach(([subject, credits]) => {
    doc.fontSize(9).font('Helvetica').text(`${subject}: ${credits.toFixed(2)}`, leftCol + 20, yPos);
    yPos += 15;
  });

  yPos += 20;
  doc.moveTo(leftCol, yPos).lineTo(doc.page.width - 72, yPos).stroke();
  yPos += 20;

  // Coursework by Grade Level
  doc.fontSize(12).font('Helvetica-Bold').text('COURSEWORK', leftCol, yPos);
  yPos += 25;

  const grades = ['9', '10', '11', '12'];
  grades.forEach(grade => {
    const gradeCourses = courses.filter(c => c.gradeLevel === grade);
    if (gradeCourses.length === 0) return;

    doc.fontSize(11).font('Helvetica-Bold').text(`Grade ${grade}`, leftCol, yPos);
    yPos += 20;

    gradeCourses.forEach(course => {
      if (yPos > doc.page.height - 100) {
        doc.addPage();
        yPos = 72;
      }

      doc.fontSize(9).font('Helvetica-Bold').text(course.courseTitle, leftCol + 10, yPos);
      doc.font('Helvetica').text(`${course.credits?.toFixed(2)} credits`, doc.page.width - 150, yPos);
      doc.text(course.grade || 'In Progress', doc.page.width - 100, yPos);
      yPos += 15;

      if (course.courseDescription) {
        doc.fontSize(8).font('Helvetica-Oblique').text(course.courseDescription, leftCol + 20, yPos, { width: 450 });
        yPos += doc.heightOfString(course.courseDescription, { width: 450 }) + 5;
      }
      yPos += 10;
    });
    yPos += 15;
  });

  // Certification Footer
  if (yPos > doc.page.height - 150) {
    doc.addPage();
    yPos = 72;
  }

  yPos = doc.page.height - 150;
  doc.moveTo(leftCol, yPos).lineTo(doc.page.width - 72, yPos).stroke();
  yPos += 20;

  doc.fontSize(9).font('Helvetica-Oblique').text(
    'I certify that this transcript is a true and accurate record of the student\'s academic work.',
    leftCol, yPos, { width: 450, align: 'center' }
  );
  yPos += 30;

  doc.text('_______________________________', leftCol + 50, yPos);
  doc.text('_______________________________', leftCol + 300, yPos);
  yPos += 15;
  doc.fontSize(8).text('Parent/Educator Signature', leftCol + 80, yPos);
  doc.text('Date', leftCol + 360, yPos);
}

// UK/GCSE Academic Learning Record
export function generateUKTranscript(doc: InstanceType<typeof PDFDocument>, data: TranscriptData) {
  const { child, family, courses } = data;
  const standardConfig = getStandardConfig(child.educationStandard);
  const progressLabels = getProgressLabel(child.educationStandard);

  // Header
  doc.fontSize(20).font('Helvetica-Bold').text('ACADEMIC LEARNING RECORD', { align: 'center' });
  doc.moveDown(0.3);
  doc.fontSize(9).font('Helvetica-Oblique').text(`${standardConfig.flag} ${standardConfig.name}`, { align: 'center' });
  doc.moveDown(0.3);
  doc.fontSize(10).font('Helvetica').text('Secondary Education Achievement Record', { align: 'center' });
  doc.moveDown(2);

  const leftCol = 72;
  let yPos = doc.y;

  // Student Information
  doc.fontSize(12).font('Helvetica-Bold').text('LEARNER INFORMATION', leftCol, yPos);
  yPos += 25;

  doc.fontSize(10).font('Helvetica-Bold').text('Learner Name:', leftCol, yPos);
  doc.font('Helvetica').text(child.name, leftCol + 120, yPos);
  yPos += 20;

  doc.font('Helvetica-Bold').text('Date of Birth:', leftCol, yPos);
  doc.font('Helvetica').text(child.birthdate ? formatDate(new Date(child.birthdate), 'd MMMM yyyy') : 'Not specified', leftCol + 120, yPos);
  yPos += 20;

  doc.font('Helvetica-Bold').text('Home Education Provider:', leftCol, yPos);
  doc.font('Helvetica').text(`${family.familyName} Home Education`, leftCol + 120, yPos);
  yPos += 40;

  // Separator
  doc.moveTo(leftCol, yPos).lineTo(doc.page.width - 72, yPos).stroke();
  yPos += 20;

  // Key Stage Progress
  doc.fontSize(12).font('Helvetica-Bold').text('KEY STAGE ACHIEVEMENTS', leftCol, yPos);
  yPos += 25;

  const keyStages = {
    'KS3': courses.filter(c => ['7', '8', '9'].includes(c.gradeLevel)),
    'KS4': courses.filter(c => ['10', '11'].includes(c.gradeLevel)),
    'KS5': courses.filter(c => ['12', '13'].includes(c.gradeLevel))
  };

  Object.entries(keyStages).forEach(([ks, stageCourses]) => {
    if (stageCourses.length === 0) return;

    doc.fontSize(11).font('Helvetica-Bold').text(ks, leftCol, yPos);
    yPos += 20;

    stageCourses.forEach(course => {
      if (yPos > doc.page.height - 100) {
        doc.addPage();
        yPos = 72;
      }

      doc.fontSize(9).font('Helvetica-Bold').text(course.courseTitle, leftCol + 10, yPos);
      
      // Show GCSE level if available
      if (course.gcseLevel) {
        doc.font('Helvetica').text(`Level: ${course.gcseLevel}`, doc.page.width - 200, yPos);
      }
      
      doc.text(course.grade || 'In Progress', doc.page.width - 100, yPos);
      yPos += 15;

      if (course.courseDescription) {
        doc.fontSize(8).font('Helvetica-Oblique').text(course.courseDescription, leftCol + 20, yPos, { width: 450 });
        yPos += doc.heightOfString(course.courseDescription, { width: 450 }) + 5;
      }
      yPos += 10;
    });
    yPos += 15;
  });

  // UCAS Points Summary (if applicable)
  const completedCourses = courses.filter(c => c.isComplete);
  if (completedCourses.length > 0) {
    if (yPos > doc.page.height - 150) {
      doc.addPage();
      yPos = 72;
    }

    doc.fontSize(11).font('Helvetica-Bold').text('UCAS TARIFF POINTS', leftCol, yPos);
    yPos += 20;
    doc.fontSize(9).font('Helvetica').text(
      'Estimated UCAS points based on completed qualifications. Please verify with official UCAS calculator.',
      leftCol + 10, yPos, { width: 450 }
    );
    yPos += 30;
  }

  // Certification
  if (yPos > doc.page.height - 150) {
    doc.addPage();
    yPos = 72;
  }

  yPos = doc.page.height - 150;
  doc.moveTo(leftCol, yPos).lineTo(doc.page.width - 72, yPos).stroke();
  yPos += 20;

  doc.fontSize(9).font('Helvetica-Oblique').text(
    'This learning record is certified as an accurate representation of the learner\'s academic achievements.',
    leftCol, yPos, { width: 450, align: 'center' }
  );
  yPos += 30;

  doc.text('_______________________________', leftCol + 50, yPos);
  doc.text('_______________________________', leftCol + 300, yPos);
  yPos += 15;
  doc.fontSize(8).text('Parent/Educator', leftCol + 90, yPos);
  doc.text('Date', leftCol + 360, yPos);
}

// IB Diploma Programme Transcript - Narrative format with TOK/CAS/EE
export function generateIBTranscript(doc: InstanceType<typeof PDFDocument>, data: TranscriptData) {
  const { child, family, courses } = data;
  const standardConfig = getStandardConfig(child.educationStandard);

  // Header
  doc.fontSize(20).font('Helvetica-Bold').text('INTERNATIONAL BACCALAUREATE', { align: 'center' });
  doc.fontSize(16).text('DIPLOMA PROGRAMME TRANSCRIPT', { align: 'center' });
  doc.moveDown(0.3);
  doc.fontSize(9).font('Helvetica-Oblique').text(`${standardConfig.flag} ${standardConfig.name}`, { align: 'center' });
  doc.moveDown(2);

  const leftCol = 72;
  let yPos = doc.y;

  // Student Information
  doc.fontSize(12).font('Helvetica-Bold').text('CANDIDATE INFORMATION', leftCol, yPos);
  yPos += 25;

  doc.fontSize(10).font('Helvetica-Bold').text('Candidate Name:', leftCol, yPos);
  doc.font('Helvetica').text(child.name, leftCol + 130, yPos);
  yPos += 20;

  doc.font('Helvetica-Bold').text('Date of Birth:', leftCol, yPos);
  doc.font('Helvetica').text(child.birthdate ? formatDate(new Date(child.birthdate), 'd MMMM yyyy') : 'Not specified', leftCol + 130, yPos);
  yPos += 20;

  doc.font('Helvetica-Bold').text('School:', leftCol, yPos);
  doc.font('Helvetica').text(`${family.familyName} - Home Education`, leftCol + 130, yPos);
  yPos += 40;

  // Separator
  doc.moveTo(leftCol, yPos).lineTo(doc.page.width - 72, yPos).stroke();
  yPos += 20;

  // IB Subject Groups
  doc.fontSize(12).font('Helvetica-Bold').text('DIPLOMA PROGRAMME SUBJECTS', leftCol, yPos);
  yPos += 25;

  const ibGroups: Record<string, TranscriptCourse[]> = {
    'Group 1: Studies in Language and Literature': [],
    'Group 2: Language Acquisition': [],
    'Group 3: Individuals and Societies': [],
    'Group 4: Sciences': [],
    'Group 5: Mathematics': [],
    'Group 6: The Arts': [],
  };

  courses.forEach(course => {
    if (course.ibGroup) {
      if (!ibGroups[course.ibGroup]) ibGroups[course.ibGroup] = [];
      ibGroups[course.ibGroup].push(course);
    }
  });

  Object.entries(ibGroups).forEach(([group, groupCourses]) => {
    if (groupCourses.length === 0) return;

    doc.fontSize(10).font('Helvetica-Bold').text(group, leftCol, yPos);
    yPos += 18;

    groupCourses.forEach(course => {
      if (yPos > doc.page.height - 100) {
        doc.addPage();
        yPos = 72;
      }

      doc.fontSize(9).font('Helvetica').text(`• ${course.courseTitle}`, leftCol + 15, yPos);
      doc.text(course.grade || 'In Progress', doc.page.width - 100, yPos);
      yPos += 15;

      if (course.courseDescription) {
        doc.fontSize(8).font('Helvetica-Oblique').text(course.courseDescription, leftCol + 25, yPos, { width: 430 });
        yPos += doc.heightOfString(course.courseDescription, { width: 430 }) + 5;
      }
      yPos += 8;
    });
    yPos += 15;
  });

  // DP Core Components
  if (yPos > doc.page.height - 200) {
    doc.addPage();
    yPos = 72;
  }

  doc.fontSize(12).font('Helvetica-Bold').text('DIPLOMA PROGRAMME CORE', leftCol, yPos);
  yPos += 25;

  doc.fontSize(10).font('Helvetica-Bold').text('Theory of Knowledge (TOK):', leftCol, yPos);
  yPos += 18;
  doc.fontSize(9).font('Helvetica-Oblique').text(
    'Student demonstrates critical thinking and reflective inquiry across disciplines.',
    leftCol + 15, yPos, { width: 450 }
  );
  yPos += 30;

  doc.fontSize(10).font('Helvetica-Bold').text('Creativity, Activity, Service (CAS):', leftCol, yPos);
  yPos += 18;
  doc.fontSize(9).font('Helvetica-Oblique').text(
    'Student engages in experiential learning through creative pursuits, physical activities, and community service.',
    leftCol + 15, yPos, { width: 450 }
  );
  yPos += 30;

  doc.fontSize(10).font('Helvetica-Bold').text('Extended Essay (EE):', leftCol, yPos);
  yPos += 18;
  doc.fontSize(9).font('Helvetica-Oblique').text(
    'Independent research project demonstrating sustained intellectual engagement.',
    leftCol + 15, yPos, { width: 450 }
  );
  yPos += 40;

  // Certification
  if (yPos > doc.page.height - 150) {
    doc.addPage();
    yPos = 72;
  }

  yPos = doc.page.height - 150;
  doc.moveTo(leftCol, yPos).lineTo(doc.page.width - 72, yPos).stroke();
  yPos += 20;

  doc.fontSize(9).font('Helvetica-Oblique').text(
    'This transcript represents the candidate\'s progress within the International Baccalaureate Diploma Programme framework.',
    leftCol, yPos, { width: 450, align: 'center' }
  );
  yPos += 30;

  doc.text('_______________________________', leftCol + 50, yPos);
  doc.text('_______________________________', leftCol + 300, yPos);
  yPos += 15;
  doc.fontSize(8).text('IB Coordinator/Educator', leftCol + 70, yPos);
  doc.text('Date', leftCol + 360, yPos);
}

// Australia/NZ NCEA/ATAR Achievement Record
export function generateANZTranscript(doc: InstanceType<typeof PDFDocument>, data: TranscriptData) {
  const { child, family, courses } = data;
  const standardConfig = getStandardConfig(child.educationStandard);
  const progressLabels = getProgressLabel(child.educationStandard);

  // Header
  doc.fontSize(20).font('Helvetica-Bold').text('ACADEMIC ACHIEVEMENT RECORD', { align: 'center' });
  doc.moveDown(0.3);
  doc.fontSize(9).font('Helvetica-Oblique').text(`${standardConfig.flag} ${standardConfig.name}`, { align: 'center' });
  doc.moveDown(0.3);
  doc.fontSize(10).font('Helvetica').text('Senior Secondary Education Record', { align: 'center' });
  doc.moveDown(2);

  const leftCol = 72;
  let yPos = doc.y;

  // Student Information
  doc.fontSize(12).font('Helvetica-Bold').text('STUDENT INFORMATION', leftCol, yPos);
  yPos += 25;

  doc.fontSize(10).font('Helvetica-Bold').text('Student Name:', leftCol, yPos);
  doc.font('Helvetica').text(child.name, leftCol + 110, yPos);
  yPos += 20;

  doc.font('Helvetica-Bold').text('Date of Birth:', leftCol, yPos);
  doc.font('Helvetica').text(child.birthdate ? formatDate(new Date(child.birthdate), 'd MMMM yyyy') : 'Not specified', leftCol + 110, yPos);
  yPos += 20;

  doc.font('Helvetica-Bold').text('Provider:', leftCol, yPos);
  doc.font('Helvetica').text(`${family.familyName} Home Education`, leftCol + 110, yPos);
  yPos += 40;

  // Separator
  doc.moveTo(leftCol, yPos).lineTo(doc.page.width - 72, yPos).stroke();
  yPos += 20;

  // NCEA/ATAR Summary
  doc.fontSize(12).font('Helvetica-Bold').text('ACADEMIC ACHIEVEMENT SUMMARY', leftCol, yPos);
  yPos += 25;

  const totalCredits = courses.reduce((sum, c) => sum + (c.credits || 0), 0);
  doc.fontSize(10).font('Helvetica-Bold').text('Total Credits Achieved:', leftCol, yPos);
  doc.font('Helvetica').text(totalCredits.toFixed(1), leftCol + 160, yPos);
  yPos += 30;

  // Achievements by Level
  const levels = {
    'Level 1': courses.filter(c => c.nceaLevel === 'Level 1'),
    'Level 2': courses.filter(c => c.nceaLevel === 'Level 2'),
    'Level 3': courses.filter(c => c.nceaLevel === 'Level 3'),
  };

  Object.entries(levels).forEach(([level, levelCourses]) => {
    if (levelCourses.length === 0) return;

    doc.fontSize(11).font('Helvetica-Bold').text(level, leftCol, yPos);
    yPos += 20;

    levelCourses.forEach(course => {
      if (yPos > doc.page.height - 100) {
        doc.addPage();
        yPos = 72;
      }

      doc.fontSize(9).font('Helvetica-Bold').text(course.courseTitle, leftCol + 10, yPos);
      doc.font('Helvetica').text(`${course.credits?.toFixed(1)} credits`, doc.page.width - 180, yPos);
      doc.text(course.grade || 'In Progress', doc.page.width - 100, yPos);
      yPos += 15;

      if (course.courseDescription) {
        doc.fontSize(8).font('Helvetica-Oblique').text(course.courseDescription, leftCol + 20, yPos, { width: 450 });
        yPos += doc.heightOfString(course.courseDescription, { width: 450 }) + 5;
      }
      yPos += 10;
    });
    yPos += 15;
  });

  // ATAR Estimate (if applicable)
  if (courses.filter(c => c.isComplete).length > 0) {
    if (yPos > doc.page.height - 150) {
      doc.addPage();
      yPos = 72;
    }

    doc.fontSize(11).font('Helvetica-Bold').text('ATAR ESTIMATE', leftCol, yPos);
    yPos += 20;
    doc.fontSize(9).font('Helvetica').text(
      'Estimated Australian Tertiary Admission Rank based on completed subjects. Official ATAR calculated by relevant state authority.',
      leftCol + 10, yPos, { width: 450 }
    );
    yPos += 30;
  }

  // Certification
  if (yPos > doc.page.height - 150) {
    doc.addPage();
    yPos = 72;
  }

  yPos = doc.page.height - 150;
  doc.moveTo(leftCol, yPos).lineTo(doc.page.width - 72, yPos).stroke();
  yPos += 20;

  doc.fontSize(9).font('Helvetica-Oblique').text(
    'This achievement record is a true and accurate reflection of the student\'s academic accomplishments.',
    leftCol, yPos, { width: 450, align: 'center' }
  );
  yPos += 30;

  doc.text('_______________________________', leftCol + 50, yPos);
  doc.text('_______________________________', leftCol + 300, yPos);
  yPos += 15;
  doc.fontSize(8).text('Parent/Educator', leftCol + 90, yPos);
  doc.text('Date', leftCol + 360, yPos);
}

// EU Competency Portfolio
export function generateEUTranscript(doc: InstanceType<typeof PDFDocument>, data: TranscriptData) {
  const { child, family, courses } = data;
  const standardConfig = getStandardConfig(child.educationStandard);

  // Header
  doc.fontSize(20).font('Helvetica-Bold').text('EDUCATIONAL PORTFOLIO', { align: 'center' });
  doc.moveDown(0.3);
  doc.fontSize(9).font('Helvetica-Oblique').text(`${standardConfig.flag} ${standardConfig.name}`, { align: 'center' });
  doc.moveDown(0.3);
  doc.fontSize(10).font('Helvetica').text('European Qualifications Framework Aligned', { align: 'center' });
  doc.moveDown(2);

  const leftCol = 72;
  let yPos = doc.y;

  // Student Information
  doc.fontSize(12).font('Helvetica-Bold').text('LEARNER PROFILE', leftCol, yPos);
  yPos += 25;

  doc.fontSize(10).font('Helvetica-Bold').text('Name:', leftCol, yPos);
  doc.font('Helvetica').text(child.name, leftCol + 80, yPos);
  yPos += 20;

  doc.font('Helvetica-Bold').text('Born:', leftCol, yPos);
  doc.font('Helvetica').text(child.birthdate ? formatDate(new Date(child.birthdate), 'd MMMM yyyy') : 'Not specified', leftCol + 80, yPos);
  yPos += 20;

  doc.font('Helvetica-Bold').text('Provider:', leftCol, yPos);
  doc.font('Helvetica').text(`${family.familyName} Home Learning`, leftCol + 80, yPos);
  yPos += 40;

  // Separator
  doc.moveTo(leftCol, yPos).lineTo(doc.page.width - 72, yPos).stroke();
  yPos += 20;

  // ECTS Credits Summary
  const totalCredits = courses.reduce((sum, c) => sum + (c.credits || 0), 0);
  doc.fontSize(12).font('Helvetica-Bold').text('ECTS CREDITS OVERVIEW', leftCol, yPos);
  yPos += 25;

  doc.fontSize(10).font('Helvetica-Bold').text('Total ECTS Credits:', leftCol, yPos);
  doc.font('Helvetica').text(totalCredits.toFixed(1), leftCol + 130, yPos);
  yPos += 30;

  // Competency Areas
  doc.fontSize(12).font('Helvetica-Bold').text('COMPETENCY AREAS', leftCol, yPos);
  yPos += 25;

  const competencies = [
    'Languages and Communication',
    'Mathematical and Scientific',
    'Digital and Technological',
    'Social and Civic',
    'Cultural Awareness and Expression',
    'Learning to Learn',
  ];

  competencies.forEach(comp => {
    const compCourses = courses.filter(c => 
      c.competencyTags?.some(tag => tag.toLowerCase().includes(comp.toLowerCase().split(' ')[0]))
    );

    if (compCourses.length === 0 && courses.length > 0) return;

    doc.fontSize(10).font('Helvetica-Bold').text(comp, leftCol, yPos);
    yPos += 18;

    if (compCourses.length > 0) {
      compCourses.forEach(course => {
        if (yPos > doc.page.height - 100) {
          doc.addPage();
          yPos = 72;
        }

        doc.fontSize(9).font('Helvetica').text(`• ${course.courseTitle}`, leftCol + 15, yPos);
        doc.text(`${course.credits?.toFixed(1)} ECTS`, doc.page.width - 120, yPos);
        yPos += 15;

        if (course.courseDescription) {
          doc.fontSize(8).font('Helvetica-Oblique').text(course.courseDescription, leftCol + 25, yPos, { width: 430 });
          yPos += doc.heightOfString(course.courseDescription, { width: 430 }) + 5;
        }
        yPos += 8;
      });
    } else {
      doc.fontSize(9).font('Helvetica-Oblique').text('Evidence to be documented', leftCol + 15, yPos);
      yPos += 18;
    }
    yPos += 15;
  });

  // Certification
  if (yPos > doc.page.height - 150) {
    doc.addPage();
    yPos = 72;
  }

  yPos = doc.page.height - 150;
  doc.moveTo(leftCol, yPos).lineTo(doc.page.width - 72, yPos).stroke();
  yPos += 20;

  doc.fontSize(9).font('Helvetica-Oblique').text(
    'This portfolio provides evidence of the learner\'s competencies aligned with the European Qualifications Framework.',
    leftCol, yPos, { width: 450, align: 'center' }
  );
  yPos += 30;

  doc.text('_______________________________', leftCol + 50, yPos);
  doc.text('_______________________________', leftCol + 300, yPos);
  yPos += 15;
  doc.fontSize(8).text('Educator/Mentor', leftCol + 90, yPos);
  doc.text('Date', leftCol + 360, yPos);
}

// Charlotte Mason/Classical Narrative Portfolio
export function generateClassicalTranscript(doc: InstanceType<typeof PDFDocument>, data: TranscriptData) {
  const { child, family, courses } = data;
  const standardConfig = getStandardConfig(child.educationStandard);

  // Header
  doc.fontSize(20).font('Helvetica-Bold').text('CLASSICAL EDUCATION PORTFOLIO', { align: 'center' });
  doc.moveDown(0.3);
  doc.fontSize(9).font('Helvetica-Oblique').text(`${standardConfig.flag} ${standardConfig.name}`, { align: 'center' });
  doc.moveDown(0.3);
  doc.fontSize(10).font('Helvetica').text('A Narrative Record of Living Learning', { align: 'center' });
  doc.moveDown(2);

  const leftCol = 72;
  let yPos = doc.y;

  // Student Information
  doc.fontSize(12).font('Helvetica-Bold').text('STUDENT PROFILE', leftCol, yPos);
  yPos += 25;

  doc.fontSize(10).font('Helvetica-Bold').text('Student:', leftCol, yPos);
  doc.font('Helvetica').text(child.name, leftCol + 80, yPos);
  yPos += 20;

  doc.font('Helvetica-Bold').text('Born:', leftCol, yPos);
  doc.font('Helvetica').text(child.birthdate ? formatDate(new Date(child.birthdate), 'd MMMM yyyy') : 'Not specified', leftCol + 80, yPos);
  yPos += 20;

  doc.font('Helvetica-Bold').text('Family:', leftCol, yPos);
  doc.font('Helvetica').text(`${family.familyName}`, leftCol + 80, yPos);
  yPos += 40;

  // Separator
  doc.moveTo(leftCol, yPos).lineTo(doc.page.width - 72, yPos).stroke();
  yPos += 20;

  // Educational Philosophy
  doc.fontSize(12).font('Helvetica-Bold').text('EDUCATIONAL APPROACH', leftCol, yPos);
  yPos += 25;

  doc.fontSize(9).font('Helvetica').text(
    'This portfolio represents a classical/Charlotte Mason approach to education, emphasizing living books, ' +
    'narration, nature study, and the cultivation of good habits. Learning is documented through narrative ' +
    'descriptions rather than conventional grades.',
    leftCol, yPos, { width: 470, align: 'justify' }
  );
  yPos += doc.heightOfString(
    'This portfolio represents a classical/Charlotte Mason approach to education, emphasizing living books, ' +
    'narration, nature study, and the cultivation of good habits. Learning is documented through narrative ' +
    'descriptions rather than conventional grades.',
    { width: 470 }
  ) + 25;

  // Learning Areas
  doc.fontSize(12).font('Helvetica-Bold').text('LEARNING JOURNEY', leftCol, yPos);
  yPos += 25;

  const subjects = ['english', 'math', 'science', 'history', 'elective'];
  subjects.forEach(subject => {
    const subjectCourses = courses.filter(c => c.subject.toLowerCase() === subject);
    if (subjectCourses.length === 0) return;

    const subjectTitle = subject.charAt(0).toUpperCase() + subject.slice(1);
    doc.fontSize(11).font('Helvetica-Bold').text(subjectTitle, leftCol, yPos);
    yPos += 20;

    subjectCourses.forEach(course => {
      if (yPos > doc.page.height - 100) {
        doc.addPage();
        yPos = 72;
      }

      doc.fontSize(9).font('Helvetica-Bold').text(course.courseTitle, leftCol + 10, yPos);
      yPos += 15;

      if (course.courseDescription) {
        doc.fontSize(9).font('Helvetica').text(course.courseDescription, leftCol + 20, yPos, { width: 450, align: 'justify' });
        yPos += doc.heightOfString(course.courseDescription, { width: 450, align: 'justify' }) + 5;
      }
      yPos += 15;
    });
    yPos += 15;
  });

  // Living Books Section
  if (yPos > doc.page.height - 200) {
    doc.addPage();
    yPos = 72;
  }

  doc.fontSize(11).font('Helvetica-Bold').text('LIVING BOOKS & RESOURCES', leftCol, yPos);
  yPos += 20;
  doc.fontSize(9).font('Helvetica-Oblique').text(
    'A selection of living books, primary sources, and quality resources that nourished this student\'s education.',
    leftCol + 10, yPos, { width: 450 }
  );
  yPos += 40;

  // Certification
  if (yPos > doc.page.height - 150) {
    doc.addPage();
    yPos = 72;
  }

  yPos = doc.page.height - 150;
  doc.moveTo(leftCol, yPos).lineTo(doc.page.width - 72, yPos).stroke();
  yPos += 20;

  doc.fontSize(9).font('Helvetica-Oblique').text(
    'This portfolio is a faithful record of the student\'s educational journey, prepared with care and integrity.',
    leftCol, yPos, { width: 450, align: 'center' }
  );
  yPos += 30;

  doc.text('_______________________________', leftCol + 50, yPos);
  doc.text('_______________________________', leftCol + 300, yPos);
  yPos += 15;
  doc.fontSize(8).text('Parent Educator', leftCol + 90, yPos);
  doc.text('Date', leftCol + 360, yPos);
}
