export function adminProfile(account) {
  const { person = {}, address = {}, localGroup } = account?.profile || {};
  return {
    person: {
      firstName: "",
      middleName: "",
      lastName: "",
      gender: "",
      email: account?.email || "",
      phone: "",
      ...person,
    },
    address: { street: "", postalCode: "", city: "", ...address },
    ...(localGroup ? { localGroup } : {}),
  };
}

export function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export const termsRequiredMessage = "Vilkår og betingelser må aksepteres";

export const agreementFieldIds = ["termsAccepted", "emailOffers", "smsOffers"];

export function agreementsFrom(values) {
  return {
    termsAccepted: true,
    emailOffers: values.emailOffers === true,
    smsOffers: values.smsOffers === true,
  };
}

const contactProfiles = ["person", "child", "recipient", "applicant"];

function memberContact(member, field) {
  return (
    member[field] ||
    contactProfiles
      .map((profile) => member.profile?.[profile]?.[field])
      .find(Boolean) ||
    member.profile?.[field] ||
    ""
  );
}

export const memberEmail = (member) => memberContact(member, "email");
export const memberPhone = (member) => memberContact(member, "phone");

const offerChannels = {
  email: { optInField: "emailOffers", contact: memberEmail },
  sms: { optInField: "smsOffers", contact: memberPhone },
};

export function isOfferChannel(channel) {
  return Object.hasOwn(offerChannels, channel);
}

export function offerRecipients(members, channel) {
  const { optInField, contact } = offerChannels[channel];
  return members
    .filter(
      (member) =>
        member.status === "active" &&
        member.profile?.[optInField] === true &&
        contact(member),
    )
    .map((member) => ({ id: member.id, contact: contact(member) }));
}

export function memberName(member) {
  const { person, child, recipient, applicant } = member.profile || {};
  const named = person || child || recipient || applicant || {};
  return [named.firstName, named.middleName, named.lastName]
    .filter(Boolean)
    .join(" ");
}

export function phoneDigits(phone) {
  return typeof phone === "string" ? phone.replace(/\D/g, "") : "";
}

const dateOnly = (date) => date.toISOString().slice(0, 10);

function addOneYear(isoDate) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCFullYear(date.getUTCFullYear() + 1);
  return dateOnly(date);
}

export const membershipValidUntil = (member) =>
  member.validUntil || addOneYear(member.createdAt.slice(0, 10));

export const membershipExpired = (member) =>
  membershipValidUntil(member) < dateOnly(new Date());

export function renewedValidUntil(member) {
  const current = membershipValidUntil(member);
  const today = dateOnly(new Date());
  return addOneYear(current > today ? current : today);
}

export function memberSummary(member) {
  return {
    id: member.id,
    type: member.type,
    status: member.status,
    name: memberName(member),
    email: memberEmail(member),
    phone: memberPhone(member),
    localGroup: member.profile?.localGroup || null,
    validUntil: membershipValidUntil(member),
    expired: membershipExpired(member),
    emailOffers: member.profile?.emailOffers === true,
    smsOffers: member.profile?.smsOffers === true,
    createdAt: member.createdAt,
  };
}
