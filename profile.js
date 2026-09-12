export function validProfile(profile) {
  return !!profile && profile.version === 1 && typeof profile.name === 'string' &&
    profile.name.trim().length > 0 && profile.name.length <= 24 &&
    Number.isInteger(profile.age) && profile.age >= 1 && profile.age <= 120 &&
    ['unspecified', 'female', 'male', 'other'].includes(profile.gender) &&
    (profile.mbti === '' || /^(I|E)(N|S)(F|T)(P|J)$/.test(profile.mbti)) &&
    ['', 'A', 'B', 'AB', 'O'].includes(profile.blood);
}
